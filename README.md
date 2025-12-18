## Liquid PFP Maker

A polished PFP Maker dapp: **upload a photo**, add **hats / glasses / seasonal beanies**, rotate/scale with an advanced transform UI, then **export a high-quality PNG** for Twitter/X or Discord.

### What's inside

- **Editor**: Fabric.js (drag, resize, rotate, selection, layers)
- **High-quality reduction**: Pica (Lanczos resize + unsharp mask for crisp exports)
- **UI**: Next.js App Router + Tailwind
- **Branding**: Liquid SVG kit in `public/brand/`

### Features

- Upload image (drag & drop)
- Add accessories from PNG library (`public/pfp/accessories/`)
- Rotate/scale via on-canvas handles + fine-tune sliders
- **Circle guide preview** (safe area for Twitter/Discord PFPs)
- Export:
  - Size: 512 / 1024 / 2048
  - Background: transparent / off-black / off-white
  - Shape: **square** or **circle** (transparent outside the circle)
- Share on X/Twitter with pre-filled tweet

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The app entry is `src/app/page.tsx` and the editor lives in `src/components/pfp/PfpMaker.tsx`.

### Adding new accessories

1. Add your PNG file to `public/pfp/accessories/` (transparent background recommended)
2. Add a new entry to `src/lib/pfp/accessories.ts`:

```typescript
{
  id: "my-accessory",
  name: "My Accessory",
  category: "Hats", // or "Glasses" or "Seasonal"
  src: "/pfp/accessories/my-accessory.png",
  suggestedY: 0.3, // 0..1 of canvas height
  suggestedWidthRatio: 0.8, // 0..1 of canvas width
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
