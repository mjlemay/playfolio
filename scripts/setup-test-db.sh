#!/bin/bash

# Setup script for test database
# Adjust connection parameters as needed for your PostgreSQL setup

echo "Setting up Playfolio test database..."

# Drop and recreate test database
psql -U postgres -c "DROP DATABASE IF EXISTS playfolio_test;" 2>/dev/null || \
psql -U $USER -c "DROP DATABASE IF EXISTS playfolio_test;"

psql -U postgres -c "CREATE DATABASE playfolio_test;" 2>/dev/null || \
psql -U $USER -c "CREATE DATABASE playfolio_test;"

# Create user if needed (you may need to adjust this)
psql -U postgres -c "CREATE USER appuser WITH PASSWORD 'apppassword';" 2>/dev/null || \
psql -U $USER -c "CREATE USER appuser WITH PASSWORD 'apppassword';" 2>/dev/null

# Grant privileges
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE playfolio_test TO appuser;" 2>/dev/null || \
psql -U $USER -c "GRANT ALL PRIVILEGES ON DATABASE playfolio_test TO appuser;"

echo "Test database setup complete!"
echo "Database URL: postgresql://appuser:apppassword@localhost:5432/playfolio_test"
