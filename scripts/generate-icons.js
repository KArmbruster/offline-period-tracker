const sharp = require('sharp');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// SVG template for the icon (red circle with highlight)
const createSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.45}" fill="#B3014F"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size * 0.40}" fill="#E53935"/>
  <ellipse cx="${size * 0.35}" cy="${size * 0.35}" rx="${size * 0.12}" ry="${size * 0.08}" fill="#FFCDD2" opacity="0.6"/>
</svg>
`;

async function generateIcons() {
  const sizes = [192, 512];

  for (const size of sizes) {
    const svg = createSvg(size);
    const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`Generated ${outputPath}`);
  }

  console.log('Icons generated successfully!');
}

generateIcons().catch(console.error);
