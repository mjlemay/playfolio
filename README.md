# PlayFolio!

This is an api to help folks manage activities at immersive events such as LARPs or experiences with light game elements.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Run In Docker

The docker will stand up a postgres container so that standing up your own database will not be necessary.

To run docker, you can use the following command:
```docker compose up -d```

Like the previous command, the app will be available at the url `localhost:3000`.
