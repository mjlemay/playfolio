-- Create test database on container startup
-- This runs automatically when the postgres container first starts

CREATE DATABASE playfolio_test;
GRANT ALL PRIVILEGES ON DATABASE playfolio_test TO appuser;
