-- Auto-create people contacts from email and meeting ingestion rows.
-- Source of truth is document_metadata because Outlook, Graph meeting-like docs,
-- and Fireflies transcripts all land there before frontend directory use.

CREATE OR REPLACE FUNCTION public.normalize_comms_contact_email(raw_identity text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  matches text[];
  candidate text;
BEGIN
  IF raw_identity IS NULL OR btrim(raw_identity) = '' THEN
    RETURN NULL;
  END IF;

  matches := regexp_match(raw_identity, '<\s*([^<>[:space:]]+@[^<>[:space:]]+\.[^<>[:space:]]+)\s*>', 'i');
  IF matches IS NULL THEN
    matches := regexp_match(raw_identity, '([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})', 'i');
  END IF;

  IF matches IS NULL THEN
    RETURN NULL;
  END IF;

  candidate := lower(btrim(matches[1]));
  candidate := regexp_replace(candidate, '[,;:]+$', '');

  IF candidate !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RETURN NULL;
  END IF;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.infer_comms_contact_name(raw_identity text, normalized_email text)
RETURNS TABLE(first_name text, last_name text, display_name text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
  parts text[];
  local_part text;
BEGIN
  cleaned := btrim(coalesce(raw_identity, ''));
  cleaned := regexp_replace(cleaned, '<[^<>]+>', '', 'g');
  cleaned := btrim(cleaned, ' "''');

  IF cleaned = '' OR cleaned = normalized_email OR cleaned ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    local_part := split_part(coalesce(normalized_email, ''), '@', 1);
    cleaned := initcap(regexp_replace(local_part, '[._+\-]+', ' ', 'g'));
  END IF;

  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');
  cleaned := nullif(btrim(cleaned), '');

  IF cleaned IS NULL THEN
    cleaned := 'Unknown';
  END IF;

  parts := regexp_split_to_array(cleaned, '\s+');
  first_name := coalesce(nullif(parts[1], ''), 'Unknown');

  IF array_length(parts, 1) > 1 THEN
    last_name := array_to_string(parts[2:array_length(parts, 1)], ' ');
  ELSE
    last_name := '';
  END IF;

  display_name := cleaned;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_people_contact_from_comms(
  raw_identity text,
  raw_display_name text DEFAULT NULL,
  source_document_metadata_id text DEFAULT NULL,
  source_kind text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  identity_for_name text;
  inferred record;
  existing_person_id uuid;
  inserted_person_id uuid;
  metadata_patch jsonb;
BEGIN
  normalized_email := public.normalize_comms_contact_email(coalesce(raw_identity, raw_display_name));

  IF normalized_email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Prevent duplicate inserts for the same email when ingestion runs overlap.
  PERFORM pg_advisory_xact_lock(hashtextextended(normalized_email, 0));

  SELECT p.id
  INTO existing_person_id
  FROM public.people p
  WHERE lower(p.email) = normalized_email
  ORDER BY
    CASE WHEN p.person_type = 'user' THEN 0 ELSE 1 END,
    p.created_at NULLS LAST,
    p.id
  LIMIT 1;

  metadata_patch := jsonb_strip_nulls(jsonb_build_object(
    'last_auto_contact_source', 'document_metadata',
    'last_auto_contact_source_id', source_document_metadata_id,
    'last_auto_contact_source_kind', source_kind,
    'last_auto_contact_seen_at', now()
  ));

  IF existing_person_id IS NOT NULL THEN
    UPDATE public.people
    SET
      metadata = coalesce(metadata, '{}'::jsonb) || metadata_patch,
      updated_at = now()
    WHERE id = existing_person_id;

    RETURN existing_person_id;
  END IF;

  identity_for_name := coalesce(nullif(raw_display_name, ''), raw_identity, normalized_email);
  SELECT *
  INTO inferred
  FROM public.infer_comms_contact_name(identity_for_name, normalized_email)
  LIMIT 1;

  INSERT INTO public.people (
    first_name,
    last_name,
    email,
    person_type,
    status,
    metadata
  )
  VALUES (
    inferred.first_name,
    inferred.last_name,
    normalized_email,
    'contact',
    'active',
    jsonb_strip_nulls(jsonb_build_object(
      'auto_created_from', 'document_metadata',
      'auto_contact_source_id', source_document_metadata_id,
      'auto_contact_source_kind', source_kind,
      'auto_contact_created_at', now(),
      'auto_contact_display_name', inferred.display_name
    ))
  )
  RETURNING id INTO inserted_person_id;

  RETURN inserted_person_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_document_metadata_people_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_kind text;
  raw_participant text;
  attendee jsonb;
  attendee_email text;
  attendee_name text;
BEGIN
  source_kind := lower(coalesce(NEW.category, NEW.type, ''));

  IF source_kind NOT IN ('email', 'meeting', 'meeting_transcript')
     AND source_kind NOT LIKE '%meeting%' THEN
    RETURN NEW;
  END IF;

  PERFORM public.upsert_people_contact_from_comms(
    NEW.organizer_email,
    NULL,
    NEW.id,
    source_kind
  );

  PERFORM public.upsert_people_contact_from_comms(
    NEW.host_email,
    NULL,
    NEW.id,
    source_kind
  );

  IF NEW.participants IS NOT NULL THEN
    FOR raw_participant IN
      SELECT btrim(value)
      FROM regexp_split_to_table(NEW.participants, '\s*,\s*') AS value
      WHERE btrim(value) <> ''
    LOOP
      PERFORM public.upsert_people_contact_from_comms(
        raw_participant,
        NULL,
        NEW.id,
        source_kind
      );
    END LOOP;
  END IF;

  IF NEW.participants_array IS NOT NULL THEN
    FOREACH raw_participant IN ARRAY NEW.participants_array
    LOOP
      PERFORM public.upsert_people_contact_from_comms(
        raw_participant,
        NULL,
        NEW.id,
        source_kind
      );
    END LOOP;
  END IF;

  IF NEW.meeting_attendees IS NOT NULL AND jsonb_typeof(NEW.meeting_attendees) = 'array' THEN
    FOR attendee IN SELECT value FROM jsonb_array_elements(NEW.meeting_attendees)
    LOOP
      attendee_email := coalesce(
        attendee ->> 'email',
        attendee ->> 'mail',
        attendee ->> 'userPrincipalName'
      );
      attendee_name := coalesce(
        attendee ->> 'displayName',
        attendee ->> 'name'
      );

      PERFORM public.upsert_people_contact_from_comms(
        attendee_email,
        attendee_name,
        NEW.id,
        source_kind
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_metadata_auto_people_contacts_trg ON public.document_metadata;
CREATE TRIGGER document_metadata_auto_people_contacts_trg
AFTER INSERT OR UPDATE OF
  participants,
  participants_array,
  meeting_attendees,
  organizer_email,
  host_email,
  category,
  type
ON public.document_metadata
FOR EACH ROW
EXECUTE FUNCTION public.sync_document_metadata_people_contacts();

CREATE INDEX IF NOT EXISTS idx_people_lower_email
ON public.people (lower(email))
WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.backfill_people_contacts_from_comms()
RETURNS TABLE(total_people_contacts_seen integer, unique_emails text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc record;
  raw_participant text;
  attendee jsonb;
  candidate_email text;
  seen_emails text[] := ARRAY[]::text[];
BEGIN
  FOR doc IN
    SELECT
      id,
      lower(coalesce(category, type, '')) AS source_kind,
      participants,
      participants_array,
      meeting_attendees,
      organizer_email,
      host_email
    FROM public.document_metadata
    WHERE lower(coalesce(category, type, '')) IN ('email', 'meeting', 'meeting_transcript')
       OR lower(coalesce(category, type, '')) LIKE '%meeting%'
  LOOP
    FOREACH raw_participant IN ARRAY ARRAY[doc.organizer_email, doc.host_email]
    LOOP
      candidate_email := public.normalize_comms_contact_email(raw_participant);
      IF candidate_email IS NOT NULL AND NOT candidate_email = ANY(seen_emails) THEN
        PERFORM public.upsert_people_contact_from_comms(raw_participant, NULL, doc.id, doc.source_kind);
        seen_emails := array_append(seen_emails, candidate_email);
      END IF;
    END LOOP;

    IF doc.participants IS NOT NULL THEN
      FOR raw_participant IN
        SELECT btrim(value)
        FROM regexp_split_to_table(doc.participants, '\s*,\s*') AS value
        WHERE btrim(value) <> ''
      LOOP
        candidate_email := public.normalize_comms_contact_email(raw_participant);
        IF candidate_email IS NOT NULL AND NOT candidate_email = ANY(seen_emails) THEN
          PERFORM public.upsert_people_contact_from_comms(raw_participant, NULL, doc.id, doc.source_kind);
          seen_emails := array_append(seen_emails, candidate_email);
        END IF;
      END LOOP;
    END IF;

    IF doc.participants_array IS NOT NULL THEN
      FOREACH raw_participant IN ARRAY doc.participants_array
      LOOP
        candidate_email := public.normalize_comms_contact_email(raw_participant);
        IF candidate_email IS NOT NULL AND NOT candidate_email = ANY(seen_emails) THEN
          PERFORM public.upsert_people_contact_from_comms(raw_participant, NULL, doc.id, doc.source_kind);
          seen_emails := array_append(seen_emails, candidate_email);
        END IF;
      END LOOP;
    END IF;

    IF doc.meeting_attendees IS NOT NULL AND jsonb_typeof(doc.meeting_attendees) = 'array' THEN
      FOR attendee IN SELECT value FROM jsonb_array_elements(doc.meeting_attendees)
      LOOP
        raw_participant := coalesce(
          attendee ->> 'email',
          attendee ->> 'mail',
          attendee ->> 'userPrincipalName'
        );
        candidate_email := public.normalize_comms_contact_email(raw_participant);

        IF candidate_email IS NOT NULL AND NOT candidate_email = ANY(seen_emails) THEN
          PERFORM public.upsert_people_contact_from_comms(
            raw_participant,
            coalesce(attendee ->> 'displayName', attendee ->> 'name'),
            doc.id,
            doc.source_kind
          );
          seen_emails := array_append(seen_emails, candidate_email);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  total_people_contacts_seen := coalesce(array_length(seen_emails, 1), 0);
  unique_emails := seen_emails;
  RETURN NEXT;
END;
$$;

-- Keep the legacy function names from the old contacts-table approach from
-- silently drifting back into use. Both now target public.people.
CREATE OR REPLACE FUNCTION public.add_meeting_participants_to_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  participant text;
BEGIN
  IF NEW.participants IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH participant IN ARRAY NEW.participants
  LOOP
    PERFORM public.upsert_people_contact_from_comms(
      participant,
      NULL,
      coalesce(NEW.id::text, NULL),
      'meeting'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_meeting_participants_to_contacts()
RETURNS TABLE(total_contacts_added integer, unique_emails text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_row record;
BEGIN
  SELECT *
  INTO result_row
  FROM public.backfill_people_contacts_from_comms();

  total_contacts_added := result_row.total_people_contacts_seen;
  unique_emails := result_row.unique_emails;
  RETURN NEXT;
END;
$$;
