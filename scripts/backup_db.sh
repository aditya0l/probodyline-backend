#!/bin/bash

# Configuration
BACKUP_DIR="/home/ubuntu/db-backups"
CONTAINER_NAME="probodyline-postgres"
DB_USER="postgres" # Default, adjust if needed
DB_NAME="probodyline" # Default, adjust if needed
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="backup_$DATE.sql.gz"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Create backup
echo "Creating backup for database $DB_NAME..."
if docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/$FILENAME"; then
    echo "Backup created successfully: $BACKUP_DIR/$FILENAME"
else
    echo "Backup failed!"
    exit 1
fi

# Rotate backups older than 7 days
echo "Removing backups older than 7 days..."
find $BACKUP_DIR -name "backup_*.sql.gz" -type f -mtime +7 -delete
