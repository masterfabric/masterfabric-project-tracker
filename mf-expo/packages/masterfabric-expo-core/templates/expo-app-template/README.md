# My MasterFabric App

This app was created using [masterfabric-expo-core](https://github.com/masterfabric/masterfabric-project-tracker/tree/main/mf-expo/packages/masterfabric-expo-core).

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your configuration values (including **`EXPO_PUBLIC_GRAPHQL_URL`** if you use a MasterFabric / mf-go GraphQL backend).

4. Start the development server:
   ```bash
   npm start
   ```

## Configuration

Edit `app/_layout.tsx` to configure MasterView initialization, including:
- Sentry error tracking
- Firebase authentication
- Supabase integration
- Theme and localization settings

## Learn More

- [MasterFabric monorepo](https://github.com/masterfabric/masterfabric-project-tracker)
- [Expo Documentation](https://docs.expo.dev/)

