import sequelize from './config/database.js';
import Attachment from './models/Attachment.js';

async function main() {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL');
    const attachments = await Attachment.findAll();
    console.log('Attachments:', JSON.stringify(attachments, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sequelize.close();
  }
}

main();
