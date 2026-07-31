from src.services.integrations.microsoft_graph.project_document_backfill import (
    run_graph_project_document_backfill,
)


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Table:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self.filters = {}
        self.in_filters = {}
        self.or_filters = []
        self.payload = None
        self.action = "select"
        self.limit_count = None
        self.negate_next = False

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def is_(self, key, value):
        parsed = None if value == "null" else value
        if self.negate_next:
            self.filters[key] = ("__not_is__", parsed)
            self.negate_next = False
            return self
        self.filters[key] = parsed
        return self

    def in_(self, key, values):
        self.in_filters[key] = set(values)
        return self

    def or_(self, filters):
        self.or_filters.extend(part.strip() for part in filters.split(",") if part.strip())
        return self

    @property
    def not_(self):
        self.negate_next = True
        return self

    def limit(self, value):
        self.limit_count = value
        return self

    def range(self, start, end):
        self.range_start = start
        self.range_end = end
        return self

    def insert(self, payload):
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        matches = [
            row
            for row in rows
            if all(
                row.get(key) != value[1]
                if isinstance(value, tuple) and value[0] == "__not_is__"
                else row.get(key) == value
                for key, value in self.filters.items()
            )
            and all(row.get(key) in values for key, values in self.in_filters.items())
            and (
                not self.or_filters
                or any(
                    (
                        part.startswith("source_system.eq.")
                        and row.get("source_system") == part.split("source_system.eq.", 1)[1]
                    )
                    or (
                        part.startswith("id.like.onedrive_%")
                        and str(row.get("id", "")).startswith("onedrive_")
                    )
                    or (
                        part.startswith("id.like.sharepoint_%")
                        and str(row.get("id", "")).startswith("sharepoint_")
                    )
                    for part in self.or_filters
                )
            )
        ]

        if self.action == "insert":
            row = {"id": len(rows) + 1, **self.payload}
            rows.append(row)
            return _Result([row])

        if self.action == "update":
            for row in matches:
                row.update(self.payload)
            return _Result(matches)

        if self.limit_count is not None:
            matches = matches[: self.limit_count]
        if hasattr(self, "range_start") and hasattr(self, "range_end"):
            matches = matches[self.range_start : self.range_end + 1]
        return _Result([dict(row) for row in matches])


class _Supabase:
    def __init__(self):
        self.store = {}

    def table(self, name):
        return _Table(self.store, name)

    def from_(self, name):
        return _Table(self.store, name)


def test_graph_project_document_backfill_promotes_missing_onedrive_rows():
    supabase = _Supabase()
    supabase.store["document_metadata"] = [
        {
            "id": "onedrive_drive-item-1",
            "title": "Scope.txt",
            "url": "https://microsoft.example/scope",
            "source": "microsoft_graph",
            "source_system": "microsoft_graph",
            "category": "document",
            "type": "document",
            "project_id": 25125,
            "file_path": "onedrive/pm@example.com/drive-item-1.txt.txt",
            "tags": "onedrive,txt",
            "source_metadata": {"graph_owner": "pm@example.com"},
        }
    ]
    supabase.store["project_documents"] = []

    result = run_graph_project_document_backfill(supabase, dry_run=False)

    assert result["eligible"] == 1
    assert result["missing"] == 1
    assert result["inserted"] == 1
    row = supabase.store["project_documents"][0]
    assert row["project_id"] == 25125
    assert row["source_system"] == "onedrive"
    assert row["source_item_id"] == "drive-item-1"
    assert row["file_url"] == "https://microsoft.example/scope"
    assert row["source_metadata"]["text_storage_path"] == "onedrive/pm@example.com/drive-item-1.txt.txt"


def test_graph_project_document_backfill_dry_run_does_not_write_existing_or_missing():
    supabase = _Supabase()
    supabase.store["document_metadata"] = [
        {
            "id": "sharepoint_drive-item-1",
            "title": "RFI.pdf",
            "source_system": "sharepoint",
            "source_item_id": "drive-item-1",
            "project_id": 761,
            "source_web_url": "https://microsoft.example/rfi",
        },
        {
            "id": "sharepoint_drive-item-2",
            "title": "Submittal.pdf",
            "source_system": "sharepoint",
            "source_item_id": "drive-item-2",
            "project_id": 761,
            "source_web_url": "https://microsoft.example/submittal",
        },
    ]
    supabase.store["project_documents"] = [
        {
            "id": 1,
            "project_id": 761,
            "source_system": "sharepoint",
            "source_item_id": "drive-item-2",
            "deleted_at": None,
        }
    ]

    result = run_graph_project_document_backfill(supabase, dry_run=True)

    assert result["eligible"] == 2
    assert result["missing"] == 1
    assert result["skipped_existing"] == 1
    assert result["inserted"] == 0
    assert len(supabase.store["project_documents"]) == 1


def test_graph_project_document_backfill_paginates_beyond_first_page():
    supabase = _Supabase()
    rows = []
    for index in range(1005):
        rows.append(
            {
                "id": f"onedrive_drive-item-{index}",
                "title": f"Doc {index}.pdf",
                "source_system": "onedrive",
                "source_item_id": f"drive-item-{index}",
                "project_id": 25125,
                "source_web_url": f"https://microsoft.example/{index}",
            }
        )
    supabase.store["document_metadata"] = rows
    supabase.store["project_documents"] = []

    result = run_graph_project_document_backfill(supabase, limit=1005, dry_run=True)

    assert result["scanned"] == 1005
    assert result["eligible"] == 1005
    assert result["missing"] == 1005
