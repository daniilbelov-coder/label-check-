import dotenv from 'dotenv';
import fs from 'fs';

for (const file of ['.env.local', '.env']) {
  if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
}
