"""
Automatic Project Assignment Logic.

Assigns documents to projects based on:
1. Project number/name/client/alias matches in title (highest confidence)
2. Participant email domain overlap with known project contacts
3. Project number/name/client/alias matches in content
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple
from supabase import Client
import os
import re
import time
from difflib import SequenceMatcher
import logging


PUBLIC_EMAIL_DOMAINS = {
    "aol.com",
    "gmail.com",
    "hotmail.com",
    "icloud.com",
    "live.com",
    "me.com",
    "msn.com",
    "outlook.com",
    "yahoo.com",
}

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AssignmentTarget:
    """Typed destination for one new ingestion assignment."""

    project_id: Optional[int]
    business_area_id: Optional[int]
    method: str
    confidence: float
    legacy_project_id: Optional[int] = None

    def __post_init__(self) -> None:
        if self.project_id is not None and self.business_area_id is not None:
            raise ValueError(
                "AssignmentTarget cannot contain both project_id and business_area_id"
            )
        if self.legacy_project_id is not None and self.business_area_id is None:
            raise ValueError(
                "AssignmentTarget legacy_project_id requires a business_area_id target"
            )


class ProjectAssigner:
    """Automatically assigns meetings to projects based on heuristics and context."""

    def __init__(self, supabase_client: Client):
        self.client = supabase_client
        self._project_cache: Optional[List[Dict[str, Any]]] = None
        self._project_cache_loaded_from_db = False
        self._project_cache_loaded_at: Optional[float] = None
        self._project_snapshot_pinned = False
        self._contact_signal_cache: Optional[Dict[int, Dict[str, set[str]]]] = None
        self._attribution_rule_cache: Optional[List[Dict[str, Any]]] = None
        self._business_area_project_map_cache: Optional[Dict[int, int]] = None

    def _get_projects(self, *, refresh: bool = False) -> List[Dict[str, Any]]:
        """Get a bounded-fresh active-project snapshot.

        Project matching is a hot path during mailbox ingestion. Re-querying the
        full project/contact payload for every eligibility check retained enough
        transient HTTP/JSON memory to exhaust the 512 MiB scheduled worker.
        One process therefore shares a time-bounded snapshot; an explicit
        refresh remains available at source-batch boundaries.
        """
        try:
            cache_ttl_seconds = int(
                os.environ.get("PROJECT_ASSIGNMENT_CACHE_TTL_SECONDS", "300")
            )
        except ValueError:
            cache_ttl_seconds = 300
        cache_ttl_seconds = max(30, min(cache_ttl_seconds, 3600))
        cache_expired = bool(
            self._project_cache_loaded_from_db
            and self._project_cache_loaded_at is not None
            and time.monotonic() - self._project_cache_loaded_at
            >= cache_ttl_seconds
        )
        if self._project_cache is None or (
            (refresh or cache_expired) and self._project_cache_loaded_from_db
        ):
            response = (
                self.client.table("projects")
                .select(
                    "id, name, project_number, aliases, team_members, stakeholders, archived"
                )
                .eq("archived", False)
                .execute()
            )
            self._project_cache = response.data or []
            self._project_cache_loaded_from_db = True
            self._project_cache_loaded_at = time.monotonic()
        # Keep the runtime guard even though the database query filters too. It
        # protects callers/tests that seed the cache directly and prevents a
        # future projection change from making archived projects eligible.
        self._project_cache = [
            project
            for project in self._project_cache
            if project.get("archived") is not True
        ]
        return self._project_cache

    def _eligible_project_ids(self) -> set[int]:
        """Return the canonical set of projects eligible for new assignments."""
        return {
            int(project["id"])
            for project in self._get_projects()
            if project.get("id") and project.get("archived") is not True
        }

    def is_project_eligible(self, project_id: Any) -> bool:
        """Validate a persisted/cached project target against current app truth."""
        self._get_projects(refresh=not self._project_snapshot_pinned)
        return self._is_eligible_project_id(
            project_id,
            self._eligible_project_ids(),
        )

    def begin_batch_snapshot(self) -> None:
        """Pin one current active-project snapshot for a bounded source batch."""
        self._get_projects(refresh=True)
        self._project_snapshot_pinned = True

    def end_batch_snapshot(self) -> None:
        """Release a source-batch snapshot so the next call refreshes app truth."""
        self._project_snapshot_pinned = False

    @staticmethod
    def _is_eligible_project_id(value: Any, eligible_project_ids: set[int]) -> bool:
        """Fail closed when a cached or persisted project target is malformed."""
        try:
            return int(value) in eligible_project_ids
        except (TypeError, ValueError):
            return False

    def assign_project(
        self,
        meeting_title: str,
        participants: List[str],
        content: Optional[str] = None,
        existing_project_id: Optional[int] = None
    ) -> Tuple[Optional[int], str, float]:
        """
        Assign a project_id to a meeting based on available signals.

        Args:
            meeting_title: Title of the meeting
            participants: List of participant names/emails
            content: Optional meeting content for context-based matching
            existing_project_id: Existing project_id if already assigned

        Returns:
            Tuple of (project_id, assignment_method, confidence)
            - project_id: Assigned project ID or None
            - assignment_method: How it was assigned (title_match, email_domain, content, existing)
            - confidence: 0.0-1.0 confidence score
        """

        # Ordinary interactive calls refresh immediately so newly archived
        # projects cannot remain eligible. Bounded ingestion batches explicitly
        # pin one snapshot, giving every item the same attribution truth while
        # avoiding repeated full project/contact payloads.
        projects = self._get_projects(
            refresh=not self._project_snapshot_pinned,
        )
        eligible_project_ids = {
            int(project["id"])
            for project in projects
            if project.get("id") and project.get("archived") is not True
        }
        if (
            existing_project_id is not None
            and not self._is_eligible_project_id(
                existing_project_id,
                eligible_project_ids,
            )
        ):
            logger.warning(
                "[ProjectAssigner] ignored existing assignment to archived, "
                "deleted, unavailable, or invalid project %s",
                existing_project_id,
            )
            existing_project_id = None

        # Strategy 1: Explicit attribution matrix rules (highest confidence)
        rule_project_id, rule_method, rule_confidence = self._match_by_attribution_rules(
            meeting_title=meeting_title,
            participants=participants,
            content=content or "",
        )
        if (
            existing_project_id is not None
            and existing_project_id > 0
            and rule_project_id
            and int(rule_project_id) != int(existing_project_id)
            and rule_confidence >= 0.93
        ):
            return rule_project_id, rule_method, rule_confidence
        if existing_project_id is None and rule_project_id and rule_confidence >= 0.8:
            return rule_project_id, rule_method, rule_confidence

        if not projects:
            return None, "no_projects", 0.0

        # Strategy 2: Direct or fuzzy project number/name match in title
        project_id, confidence = self._match_by_title(meeting_title, projects)
        if (
            existing_project_id is not None
            and existing_project_id > 0
            and project_id
            and int(project_id) != int(existing_project_id)
            and confidence >= 0.93
        ):
            return project_id, "title_correction", confidence

        # If already assigned and no strong title conflict exists, keep it.
        if existing_project_id is not None and existing_project_id > 0:
            return existing_project_id, "existing", 1.0

        if rule_project_id and rule_confidence >= 0.8:
            return rule_project_id, rule_method, rule_confidence

        if project_id and confidence >= 0.8:
            return project_id, "title_match", confidence

        # Strategy 3: Project-directory participant signals
        contact_project_id, contact_method, contact_conf = self._match_by_project_contacts(participants)
        if contact_project_id and contact_conf >= 0.7:
            return contact_project_id, contact_method, contact_conf

        # Strategy 4: Participant email domains recorded on project metadata
        email_project_id, email_conf = self._match_by_email_domains(participants, projects)
        if email_project_id and email_conf >= 0.7:
            return email_project_id, "email_domain", email_conf

        # Strategy 5: Content keywords (if provided)
        if content:
            content_project_id, content_conf = self._match_by_content(content, projects)
            if content_project_id and content_conf >= 0.6:
                return content_project_id, "content_match", content_conf

        # If we got a lower-confidence title match, use it as fallback
        if project_id:
            return project_id, "title_match_low_conf", confidence

        # No confident assignment
        return None, "unassigned", 0.0

    def assign_scope(
        self,
        meeting_title: str,
        participants: List[str],
        content: Optional[str] = None,
        existing_project_id: Optional[int] = None,
        migrate_mapped_existing: bool = False,
    ) -> AssignmentTarget:
        """
        Resolve one typed destination for new ingestion.

        Existing project attribution stays available through ``assign_project``.
        This method converts mapped internal-container projects into their
        Business Area target so migrated callers cannot write both scopes.

        ``migrate_mapped_existing`` is an explicit cutover switch for callers
        repairing records that predate typed scope. It preserves ordinary
        existing project attribution while converting only projects present in
        the canonical ``business_area_project_map`` table.
        """
        project_id, method, confidence = self.assign_project(
            meeting_title=meeting_title,
            participants=participants,
            content=content,
            existing_project_id=existing_project_id,
        )
        if project_id is None:
            return AssignmentTarget(
                project_id=None,
                business_area_id=None,
                method=method,
                confidence=confidence,
            )

        if (
            existing_project_id is not None
            and int(project_id) == int(existing_project_id)
            and method == "existing"
        ):
            if migrate_mapped_existing:
                business_area_id = self._get_business_area_project_map().get(
                    int(project_id)
                )
                if business_area_id is not None:
                    return AssignmentTarget(
                        project_id=None,
                        business_area_id=business_area_id,
                        legacy_project_id=int(project_id),
                        method="existing_business_area_mapping",
                        confidence=confidence,
                    )
            return AssignmentTarget(
                project_id=int(project_id),
                business_area_id=None,
                method=method,
                confidence=confidence,
            )

        business_area_id = self._get_business_area_project_map().get(int(project_id))
        if business_area_id is not None:
            return AssignmentTarget(
                project_id=None,
                business_area_id=business_area_id,
                legacy_project_id=int(project_id),
                method=method,
                confidence=confidence,
            )

        return AssignmentTarget(
            project_id=int(project_id),
            business_area_id=None,
            method=method,
            confidence=confidence,
        )

    def _match_by_attribution_rules(
        self,
        meeting_title: str,
        participants: List[str],
        content: str,
    ) -> Tuple[Optional[int], str, float]:
        """Match by explicit project attribution rules owned in the database."""
        rules = self._get_attribution_rules()
        if not rules:
            return None, "no_attribution_rules", 0.0

        title = self._normalize_text(meeting_title)
        body = self._normalize_text(content[:3000])
        combined = f"{title} {body}".strip()
        participant_emails = self._extract_emails(participants)
        participant_domains = self._extract_domains(participants)

        scored_matches: List[Tuple[int, float, str, int]] = []
        for rule in rules:
            project_id = rule.get("project_id")
            raw_pattern = str(rule.get("pattern") or "").strip().lower()
            pattern = self._normalize_text(raw_pattern)
            rule_type = str(rule.get("rule_type") or "").lower()
            if not project_id or not raw_pattern:
                continue

            confidence = float(rule.get("confidence") or 0.9)
            priority = int(rule.get("priority") or 100)
            matched = False
            method = f"attribution_rule:{rule_type}"

            if rule_type == "title_keyword":
                matched = bool(pattern and (self._contains_token(title, pattern) or pattern in title))
            elif rule_type in {"keyword", "phrase"}:
                matched = bool(pattern and (self._contains_token(combined, pattern) or pattern in combined))
            elif rule_type == "email":
                matched = raw_pattern in participant_emails
            elif rule_type == "domain":
                matched = raw_pattern.removeprefix("@") in participant_domains

            if matched:
                scored_matches.append((int(project_id), confidence, method, priority))

        if not scored_matches:
            return None, "no_attribution_rule_match", 0.0

        scored_matches.sort(key=lambda item: (-item[1], item[3], item[0]))
        best_project_id, confidence, method, _priority = scored_matches[0]
        if len(scored_matches) > 1 and scored_matches[1][1] == confidence and scored_matches[1][0] != best_project_id:
            return None, "ambiguous_attribution_rule", 0.0
        return best_project_id, method, confidence

    def _match_by_title(
        self,
        meeting_title: str,
        projects: List[Dict[str, Any]]
    ) -> Tuple[Optional[int], float]:
        """Match project by number/name/alias/client appearing in title."""
        title_lower = self._normalize_text(meeting_title)
        if not title_lower:
            return None, 0.0

        scored_matches: List[Tuple[int, float]] = []
        for project in projects:
            project_id = project.get("id")
            if not project_id:
                continue

            score = 0.0
            project_number = self._normalize_text(project.get("project_number"))
            project_name = self._normalize_text(project.get("name"))
            client_name = self._normalize_text(project.get("client_name") or project.get("client") or "")

            # Exact phrase matches
            if project_number and self._contains_token(title_lower, project_number):
                score = max(score, 0.98)
            if project_name and self._contains_token(title_lower, project_name):
                score = max(score, 0.95)
            if project_name and self._fuzzy_phrase_match(project_name, title_lower):
                score = max(score, 0.88)
            if client_name and self._fuzzy_phrase_match(client_name, title_lower):
                score = max(score, 0.84)

            # Alias/abbreviation matches (e.g., "WFC")
            for alias in self._extract_aliases(project):
                alias_norm = self._normalize_text(alias)
                if not alias_norm:
                    continue
                if self._contains_token(title_lower, alias_norm):
                    score = max(score, 0.92 if len(alias_norm) <= 5 else 0.90)
                elif len(alias_norm) >= 8 and self._fuzzy_phrase_match(alias_norm, title_lower):
                    score = max(score, 0.86)

            if score > 0:
                scored_matches.append((int(project_id), score))

        if not scored_matches:
            return None, 0.0

        scored_matches.sort(key=lambda item: item[1], reverse=True)
        return scored_matches[0]

    def _match_by_email_domains(
        self,
        participants: List[str],
        projects: List[Dict[str, Any]]
    ) -> Tuple[Optional[int], float]:
        """Match project by participant email domains."""
        participant_domains = self._extract_domains(participants)
        if not participant_domains:
            return None, 0.0

        best_project_id: Optional[int] = None
        best_overlap = 0
        for project in projects:
            project_domains = self._project_domains(project)
            overlap = len(participant_domains.intersection(project_domains))
            if overlap > best_overlap:
                best_overlap = overlap
                best_project_id = int(project["id"])

        if best_project_id is None or best_overlap == 0:
            return None, 0.0

        confidence = min(0.88, 0.72 + (best_overlap - 1) * 0.08)
        return best_project_id, confidence

    def _match_by_project_contacts(self, participants: List[str]) -> Tuple[Optional[int], str, float]:
        """Match participants to project directory contacts and project companies."""
        participant_emails = self._extract_assignable_emails(participants)
        participant_domains = self._extract_domains(participants)
        if not participant_emails and not participant_domains:
            return None, "no_participant_email", 0.0

        signals = self._get_project_contact_signals()
        if not signals:
            return None, "no_project_contact_signals", 0.0

        direct_scores: Dict[int, int] = {}
        domain_scores: Dict[int, int] = {}

        for project_id, project_signals in signals.items():
            direct_overlap = participant_emails.intersection(project_signals["emails"])
            if direct_overlap:
                direct_scores[project_id] = len(direct_overlap)

            domain_overlap = participant_domains.intersection(project_signals["domains"])
            if domain_overlap:
                domain_scores[project_id] = len(domain_overlap)

        direct_project_id, direct_score, direct_second = self._best_score(direct_scores)
        if direct_project_id and direct_score > direct_second:
            confidence = min(0.94, 0.86 + (direct_score - 1) * 0.04)
            return direct_project_id, "project_directory_email", confidence

        domain_project_id, domain_score, domain_second = self._best_score(domain_scores)
        if domain_project_id and domain_score > domain_second:
            confidence = min(0.84, 0.74 + (domain_score - 1) * 0.04)
            return domain_project_id, "project_company_domain", confidence

        return None, "ambiguous_project_contact", 0.0

    def _match_by_content(
        self,
        content: str,
        projects: List[Dict[str, Any]]
    ) -> Tuple[Optional[int], float]:
        """Match project by project number/name/client/alias mentions in content."""
        content_lower = self._normalize_text(content[:3000])
        if not content_lower:
            return None, 0.0

        # Count name mentions per project
        project_scores: Dict[int, float] = {}

        for project in projects:
            score = 0.0
            project_id = project.get("id")
            if not project_id:
                continue

            # Project name mentions
            project_number = self._normalize_text(project.get("project_number"))
            if project_number and self._contains_token(content_lower, project_number):
                score += 4

            project_name = self._normalize_text(project.get("name"))
            if project_name and self._contains_token(content_lower, project_name):
                score += 3

            # Alias mentions (short aliases matter, e.g. WFC)
            for alias in self._extract_aliases(project):
                alias_norm = self._normalize_text(alias)
                if alias_norm and self._contains_token(content_lower, alias_norm):
                    score += 2 if len(alias_norm) <= 5 else 1.5

            if score > 0:
                project_scores[int(project_id)] = score

        if not project_scores:
            return None, 0.0

        # Return project with highest score
        best_project_id = max(project_scores, key=project_scores.get)
        best_score = project_scores[best_project_id]

        # Convert score to confidence (cap at 0.7 for content-based)
        confidence = min(0.7, best_score / 5.0)

        return best_project_id, confidence

    @staticmethod
    def _normalize_text(value: Optional[str]) -> str:
        if not value:
            return ""
        return re.sub(r"\s+", " ", re.sub(r"[^a-zA-Z0-9]+", " ", value)).strip().lower()

    @staticmethod
    def _contains_token(text: str, token: str) -> bool:
        if not token:
            return False
        return bool(re.search(rf"\b{re.escape(token)}\b", text))

    @staticmethod
    def _extract_aliases(project: Dict[str, Any]) -> List[str]:
        aliases = project.get("aliases") or []
        return [str(a).strip() for a in aliases if str(a).strip()]

    @staticmethod
    def _fuzzy_phrase_match(needle: str, haystack: str) -> bool:
        needle_tokens = needle.split()
        haystack_tokens = haystack.split()
        if len(needle) < 8 or not needle_tokens or len(haystack_tokens) < len(needle_tokens):
            return False
        window_size = len(needle_tokens)
        for start in range(0, len(haystack_tokens) - window_size + 1):
            window = " ".join(haystack_tokens[start : start + window_size])
            if SequenceMatcher(None, needle, window).ratio() >= 0.88:
                return True
        return False

    @staticmethod
    def _extract_domains(values: List[str]) -> set[str]:
        domains: set[str] = set()
        for value in values:
            if not value:
                continue
            for match in re.findall(r"[a-zA-Z0-9._%+\-]+@([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})", value):
                domain = match.lower()
                if ProjectAssigner._is_assignable_domain(domain):
                    domains.add(domain)
        return domains

    @staticmethod
    def _extract_emails(values: List[str]) -> set[str]:
        emails: set[str] = set()
        for value in values:
            if not value:
                continue
            for match in re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", value):
                emails.add(match.lower())
        return emails

    @staticmethod
    def _extract_assignable_emails(values: List[str]) -> set[str]:
        emails: set[str] = set()
        for email in ProjectAssigner._extract_emails(values):
            domain = email.rsplit("@", 1)[-1]
            if ProjectAssigner._is_assignable_domain(domain):
                emails.add(email)
        return emails

    @staticmethod
    def _domain_from_url(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        normalized = value.strip().lower()
        normalized = re.sub(r"^https?://", "", normalized)
        normalized = normalized.split("/", 1)[0].split(":", 1)[0]
        normalized = normalized.removeprefix("www.")
        return normalized if "." in normalized else None

    @staticmethod
    def _is_assignable_domain(domain: str) -> bool:
        company_domains = {
            d.strip().lower()
            for d in os.environ.get("COMPANY_EMAIL_DOMAINS", "alleatogroup.com").split(",")
            if d.strip()
        }
        return domain not in PUBLIC_EMAIL_DOMAINS and domain not in company_domains

    @staticmethod
    def _best_score(scores: Dict[int, int]) -> Tuple[Optional[int], int, int]:
        if not scores:
            return None, 0, 0
        ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
        best_project_id, best_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0
        return best_project_id, best_score, second_score

    def _get_project_contact_signals(self) -> Dict[int, Dict[str, set[str]]]:
        eligible_project_ids = self._eligible_project_ids()
        if self._contact_signal_cache is not None:
            eligible_signals = {
                project_id: project_signals
                for project_id, project_signals in self._contact_signal_cache.items()
                if self._is_eligible_project_id(project_id, eligible_project_ids)
            }
            skipped_count = len(self._contact_signal_cache) - len(eligible_signals)
            if skipped_count:
                logger.warning(
                    "[ProjectAssigner] ignored %d cached contact signal set(s) "
                    "targeting archived, unavailable, or invalid projects",
                    skipped_count,
                )
            self._contact_signal_cache = eligible_signals
            return self._contact_signal_cache

        signals: Dict[int, Dict[str, set[str]]] = {}

        contact_references = (
            self.client.table("project_contact_references")
            .select("project_id,person_id,company_id,status")
            .eq("status", "active")
            .execute()
            .data
            or []
        )
        memberships = (
            self.client.table("project_directory_memberships")
            .select("project_id,person_id,status")
            .eq("status", "active")
            .execute()
            .data
            or []
        )
        people = self.client.table("people").select("id,email,company_id,status").execute().data or []
        project_companies = (
            self.client.table("project_companies")
            .select("project_id,company_id,email_address,status")
            .eq("status", "ACTIVE")
            .execute()
            .data
            or []
        )
        companies = self.client.table("companies").select("id,website").execute().data or []

        people_by_id = {str(person.get("id")): person for person in people if person.get("id")}
        company_domains = {
            str(company.get("id")): domain
            for company in companies
            if company.get("id")
            for domain in [self._domain_from_url(company.get("website"))]
            if domain and self._is_assignable_domain(domain)
        }

        def ensure_project(project_id: int) -> Dict[str, set[str]]:
            if project_id not in signals:
                signals[project_id] = {"emails": set(), "domains": set()}
            return signals[project_id]

        for reference in contact_references:
            project_id = reference.get("project_id")
            person = people_by_id.get(str(reference.get("person_id")))
            if not project_id or int(project_id) not in eligible_project_ids or not person:
                continue
            project_signals = ensure_project(int(project_id))
            email = str(person.get("email") or "").strip().lower()
            if email and self._extract_assignable_emails([email]):
                project_signals["emails"].add(email)
                project_signals["domains"].update(self._extract_domains([email]))
            company_domain = company_domains.get(
                str(reference.get("company_id") or person.get("company_id"))
            )
            if company_domain:
                project_signals["domains"].add(company_domain)

        for membership in memberships:
            project_id = membership.get("project_id")
            person = people_by_id.get(str(membership.get("person_id")))
            if not project_id or int(project_id) not in eligible_project_ids or not person:
                continue
            project_signals = ensure_project(int(project_id))
            email = str(person.get("email") or "").strip().lower()
            if email and self._extract_assignable_emails([email]):
                project_signals["emails"].add(email)
                project_signals["domains"].update(self._extract_domains([email]))
            company_domain = company_domains.get(str(person.get("company_id")))
            if company_domain:
                project_signals["domains"].add(company_domain)

        for project_company in project_companies:
            project_id = project_company.get("project_id")
            if not project_id or int(project_id) not in eligible_project_ids:
                continue
            project_signals = ensure_project(int(project_id))
            email = str(project_company.get("email_address") or "").strip().lower()
            if email and self._extract_assignable_emails([email]):
                project_signals["emails"].add(email)
                project_signals["domains"].update(self._extract_domains([email]))
            company_domain = company_domains.get(str(project_company.get("company_id")))
            if company_domain:
                project_signals["domains"].add(company_domain)

        self._contact_signal_cache = signals
        return signals

    def _project_domains(self, project: Dict[str, Any]) -> set[str]:
        domains: set[str] = set()
        team_members = project.get("team_members") or []
        for member in team_members:
            domains.update(self._extract_domains([str(member)]))

        stakeholders = project.get("stakeholders") or []
        if isinstance(stakeholders, list):
            for item in stakeholders:
                domains.update(self._extract_domains([str(item)]))
        elif isinstance(stakeholders, dict):
            for value in stakeholders.values():
                domains.update(self._extract_domains([str(value)]))

        return domains

    def _get_attribution_rules(self) -> List[Dict[str, Any]]:
        if self._attribution_rule_cache is None:
            try:
                rows = (
                    self.client.table("project_attribution_rules")
                    .select(
                        "id,project_id,business_area_id,rule_type,pattern,"
                        "confidence,priority,status"
                    )
                    .eq("status", "active")
                    .execute()
                    .data
                    or []
                )
            except Exception as exc:
                logger.warning("[ProjectAssigner] project_attribution_rules unavailable: %s", exc)
                rows = []
        else:
            rows = self._attribution_rule_cache

        eligible_project_ids = self._eligible_project_ids()
        has_business_area_rules = any(
            row.get("business_area_id") is not None for row in rows
        )
        area_to_legacy_project = (
            {
                business_area_id: project_id
                for project_id, business_area_id in self._get_business_area_project_map().items()
            }
            if has_business_area_rules
            else {}
        )
        eligible_rows: List[Dict[str, Any]] = []
        for row in rows:
            business_area_id = row.get("business_area_id")
            if business_area_id is not None:
                legacy_project_id = area_to_legacy_project.get(int(business_area_id))
                if legacy_project_id is None:
                    continue
                eligible_rows.append(
                    {
                        **row,
                        "project_id": legacy_project_id,
                        "_typed_business_area_rule": True,
                    }
                )
                continue
            if row.get("project_id") and self._is_eligible_project_id(
                row["project_id"], eligible_project_ids
            ):
                eligible_rows.append(row)
        skipped_count = len(rows) - len(eligible_rows)
        if skipped_count:
            logger.warning(
                "[ProjectAssigner] ignored %d active attribution rule(s) targeting "
                "archived, unavailable, or unmapped destinations",
                skipped_count,
            )
        self._attribution_rule_cache = eligible_rows
        return eligible_rows

    def _get_business_area_project_map(self) -> Dict[int, int]:
        """Load the permanent container-project to Brain-branch mapping."""
        if self._business_area_project_map_cache is not None:
            return self._business_area_project_map_cache

        try:
            rows = (
                self.client.table("business_area_project_map")
                .select("project_id,business_area_id")
                .execute()
                .data
                or []
            )
        except Exception as exc:
            raise RuntimeError(
                "Business Area assignment mapping is unavailable; refusing "
                "typed ingestion assignment"
            ) from exc

        mapping: Dict[int, int] = {}
        invalid_rows = 0
        for row in rows:
            try:
                project_id = int(row["project_id"])
                business_area_id = int(row["business_area_id"])
            except (KeyError, TypeError, ValueError):
                invalid_rows += 1
                continue
            if project_id <= 0 or business_area_id <= 0:
                invalid_rows += 1
                continue
            mapping[project_id] = business_area_id

        if invalid_rows:
            logger.warning(
                "[ProjectAssigner] ignored %d invalid Business Area project "
                "mapping row(s)",
                invalid_rows,
            )

        self._business_area_project_map_cache = mapping
        return mapping


def batch_assign_projects(
    supabase_client: Client,
    limit: int = 100,
    min_confidence: float = 0.7
) -> Dict[str, Any]:
    """
    Batch process unassigned meetings and assign projects.

    Args:
        supabase_client: Supabase client instance
        limit: Max number of documents to process
        min_confidence: Minimum confidence to make assignment (default 0.7)

    Returns:
        Stats dict with counts of assigned/skipped/failed
    """
    assigner = ProjectAssigner(supabase_client)

    # Get meetings without project_id
    response = supabase_client.table("document_metadata").select(
        "id, title, participants_array, content, project_id"
    ).is_("project_id", "null").limit(limit).execute()

    unassigned = response.data or []

    stats = {
        "total": len(unassigned),
        "assigned": 0,
        "skipped_low_confidence": 0,
        "failed": 0,
        "methods": {}
    }

    for doc in unassigned:
        try:
            project_id, method, confidence = assigner.assign_project(
                meeting_title=doc.get("title", ""),
                participants=doc.get("participants_array", []),
                content=doc.get("content", "")[:3000],  # First 3k chars
                existing_project_id=doc.get("project_id")
            )

            if project_id and confidence >= min_confidence:
                # Assign the project
                supabase_client.table("document_metadata").update({
                    "project_id": project_id
                }).eq("id", doc["id"]).execute()

                stats["assigned"] += 1
                stats["methods"][method] = stats["methods"].get(method, 0) + 1

                print(f"✓ Assigned '{doc.get('title', 'Untitled')[:50]}...' to project {project_id} ({method}, {confidence:.2f})")
            else:
                stats["skipped_low_confidence"] += 1

        except Exception as e:
            stats["failed"] += 1
            print(f"✗ Failed to assign '{doc.get('title', 'Untitled')[:50]}...': {str(e)}")

    return stats
