# Full Cycle Immersion 20 - Vehicle tracking system

## Description

Nest repository (Backend)

## Requirements

You need to integrate with Google Maps, which requires creating an API key on Google Cloud Platform. To do so, follow these steps:

1. Go to [Google Cloud Platform](https://cloud.google.com/).
2. Create a new project.
3. Enable the Google Maps Places and Directions APIs.
4. Save the generated API key.

## Running the application

Generate the `.env` file with the command:

```
cp .env.example .env
```

Put the API key generated on Google Cloud Platform in the `.env` file.

Start the Nest.js and MongoDB containers:

```bash
docker-compose up -d
```

Enter the Nest.js container and install the dependencies:

```bash
docker-compose exec nest bash
npm install
```

Run the server:

```bash
npm run start:dev
```

The HTTP call specifications are in the `api.http` file. You can use the VSCode `REST Client` extension to make the calls.
