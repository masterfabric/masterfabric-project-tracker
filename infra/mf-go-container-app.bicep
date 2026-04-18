@description('ACR server name, e.g. masterfabricexpogo.azurecr.io')
param acrServer string

@description('ACR registry name (e.g. masterfabricexpogo)')
param acrName string = 'masterfabricexpogo'

@description('ACR admin password')
@secure()
param acrAdminPassword string

@description('Container image, e.g. masterfabricexpogo.azurecr.io/mf-go:latest')
param containerImage string

@description('Environment name for Container Apps')
param envName string = 'mf-go-env'

@description('Location')
param location string = resourceGroup().location

@description('App name')
param appName string = 'mf-go'

@description('Postgres DSN')
@secure()
param databaseDsn string

@description('Shared Redis URL (redis://...)')
@secure()
param redisUrl string

@description('JWT secret (min 32 chars)')
@secure()
param jwtSecret string

@description('Minimum replicas')
@minValue(0)
param minReplicas int = 1

@description('Maximum replicas')
@minValue(1)
param maxReplicas int = 5

// Container Apps environment
resource managedEnv 'Microsoft.App/managedEnvironments@2024-02-02-preview' = {
  name: envName
  location: location
  properties: {
  }
}

// Container App for mf-go
resource mfGoApp 'Microsoft.App/containerApps@2024-02-02-preview' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: managedEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acrServer
          username: acrName
          passwordSecretRef: 'acr-password'
        }
      ]
      activeRevisionsMode: 'single'
      secrets: [
        {
          name: 'database-dsn'
          value: databaseDsn
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
        {
          name: 'redis-url'
          value: redisUrl
        }
        {
          name: 'acr-password'
          value: acrAdminPassword
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'mf-go'
          image: containerImage
          resources: {
            cpu: 1
            memory: '2Gi'
          }
          env: [
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'DATABASE_DSN'
              secretRef: 'database-dsn'
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'RABBITMQ_URL'
              value: 'amqp://guest:guest@127.0.0.1:5672/'
            }
            {
              name: 'RABBITMQ_ENABLED'
              value: 'true'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'JWT_ACCESS_TTL'
              value: '15m'
            }
            {
              name: 'JWT_REFRESH_TTL'
              value: '168h'
            }
            {
              name: 'LOG_LEVEL'
              value: 'info'
            }
            {
              name: 'LOG_FORMAT'
              value: 'json'
            }
            {
              name: 'GRAPHQL_INTROSPECTION'
              value: 'false'
            }
          ]
        }
        {
          name: 'rabbitmq'
          image: 'rabbitmq:3-management-alpine'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}
