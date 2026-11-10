# Full Cycle Immersion 20 - Vehicle tracking system

## Description

Next.js repository (application front-end).

## Requirements

You need to integrate with Google Maps, which requires creating an API key on Google Cloud Platform. To do so, follow these steps:

1. Go to [Google Cloud Platform](https://cloud.google.com/).
2. Create a new project.
3. Enable the Google Maps Places, Directions and Maps JavaScript APIs.
4. Save the generated API key.

## Running the application

Start the container:

```
docker compose up -d
```

Access the Next.js container:

```
docker compose exec next bash
```

Generate the `.env` file with the command:

```
cp .env.example .env
```

Install the dependencies:

```bash
npm install
```

Run the server:

```bash
npm run dev
```
