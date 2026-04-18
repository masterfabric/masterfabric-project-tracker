#!/usr/bin/env bash
set -e

RG="${AZURE_RESOURCE_GROUP:-mf-rg}"
LOCATION="${AZURE_LOCATION:-francecentral}"
ACR_NAME="${AZURE_ACR_NAME:-masterfabricexpogo}"

# Required: set these or pass as env
: "${DATABASE_DSN:?Set DATABASE_DSN (postgres://user:pass@host:5432/db?sslmode=require)}"
: "${REDIS_URL:?Set REDIS_URL (redis://:password@host:6380/0?ssl=true)}"
: "${JWT_SECRET:?Set JWT_SECRET (min 32 chars)}"

ACR_PASSWORD=$(az acr credential show --name "$ACR_NAME" --query 'passwords[0].value' -o tsv)

az deployment group create \
  --resource-group "$RG" \
  --template-file infra/mf-go-container-app.bicep \
  --parameters \
    location="$LOCATION" \
    acrServer="${ACR_NAME}.azurecr.io" \
    acrName="$ACR_NAME" \
    acrAdminPassword="$ACR_PASSWORD" \
    containerImage="${ACR_NAME}.azurecr.io/mf-go:latest" \
    databaseDsn="$DATABASE_DSN" \
    redisUrl="$REDIS_URL" \
    jwtSecret="$JWT_SECRET"
