#!/bin/bash
# Runs once when the MongoDB container is first created.
# Creates the uassist_api user with access to all databases.
set -e

mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
    --authenticationDatabase admin \
    --eval "
        db.getSiblingDB('admin').createUser({
            user: 'uassist_api',
            pwd: '$MONGO_API_PASSWORD',
            roles: [{ role: 'readWriteAnyDatabase', db: 'admin' }]
        });
        print('uassist_api user created');
    "
