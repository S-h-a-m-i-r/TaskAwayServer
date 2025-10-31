import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, '..', 'templates');

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a, b) {
  return a === b;
});

Handlebars.registerHelper('formatNumber', function (num) {
  if (typeof num !== 'number' || isNaN(num)) return '0.00';
  return num.toFixed(2);
});

// Helper function to encode SVG to data URL
const getLogoDataUrl = () => {
  try {
    const logoPath = path.join(templatesDir, 'images', 'logo.svg');
    const logoContent = fs.readFileSync(logoPath, 'utf8');
    const encodedLogo = Buffer.from(logoContent).toString('base64');
    return `data:image/svg+xml;base64,${encodedLogo}`;
  } catch (error) {
    console.error('Error reading logo file:', error);
    return null;
  }
};

// Read and compile template
export const getTemplate = (templateName) => {
  const templatePath = path.join(templatesDir, `${templateName}.hbs`);
  const templateSource = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);

  // Return a function that includes logo data
  return (data) => {
    const logoDataUrl = getLogoDataUrl();
    return template({ ...data, logoDataUrl });
  };
};

export default {
  getTemplate
};