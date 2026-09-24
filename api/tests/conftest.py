import os
import tempfile

# Point the app at a throwaway sqlite file for the test session, isolated from
# whatever dev/prod database happens to sit in api/healthcare_app.db.
_test_db_fd, _test_db_path = tempfile.mkstemp(suffix=".db")
os.close(_test_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_test_db_path}"


def pytest_sessionfinish(session, exitstatus):
    try:
        os.remove(_test_db_path)
    except OSError:
        pass
