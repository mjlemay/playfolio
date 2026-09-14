-- Create the Ory Kratos database on container startup.
-- Runs automatically only when the postgres data volume is empty.
-- Existing volume? Run once:
--   docker compose exec postgres psql -U appuser -d playfolio -c "CREATE DATABASE kratos;"

CREATE DATABASE kratos;
GRANT ALL PRIVILEGES ON DATABASE kratos TO appuser;
