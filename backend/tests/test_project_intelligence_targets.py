from src.services.project_intelligence.targets import ensure_client_project_target


class _Result:
    def __init__(self, data=None):
        self.data = data or []


class _Table:
    def __init__(self, store, name):
        self.store = store
        self.name = name
        self.filters = {}
        self.payload = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def limit(self, *_args):
        return self

    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        rows = self.store.setdefault(self.name, [])
        if self.payload is not None:
            row = {"id": f"target-{len(rows) + 1}", **self.payload}
            rows.append(row)
            return _Result([row])
        return _Result([
            row for row in rows
            if all(row.get(key) == value for key, value in self.filters.items())
        ])


class _Client:
    def __init__(self):
        self.store = {"projects": [{"id": 7, "name": "River House", "project_number": "24-007"}]}

    def table(self, name):
        return _Table(self.store, name)


def test_target_creation_is_canonical_and_idempotent():
    client = _Client()
    first = ensure_client_project_target(client, 7, compiler_version="project_synthesizer_v1")
    second = ensure_client_project_target(client, 7, compiler_version="project_synthesizer_v1")

    assert first["id"] == second["id"]
    assert first["metadata"] == {
        "created_by": "project_intelligence",
        "projection_version": "project_synthesizer_v1",
    }
    assert len(client.store["intelligence_targets"]) == 1
