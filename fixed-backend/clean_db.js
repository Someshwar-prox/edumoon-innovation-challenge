const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

async function clean() {
  const docs = await prisma.document.findMany({
    where: {
      url: {
        contains: 'Bombay',
      }
    }
  });
  console.log("Found Bombay docs by URL:", docs.length);
  
  const docs2 = await prisma.document.findMany({
    where: {
      filename: {
        contains: 'Bombay'
      }
    }
  });
  console.log("Found Bombay docs by filename:", docs2.length);
  
  const allBombay = [...docs, ...docs2];
  for (const d of allBombay) {
    console.log("Deleting", d.id);
    await prisma.document.delete({ where: { id: d.id } });
    
    // Also tell ai-service to delete from Qdrant
    try {
      await axios.delete(`http://127.0.0.1:8000/v1/kb/documents/${d.id}`);
      console.log("Deleted from Qdrant");
    } catch(e) {
      console.error("Failed to delete from Qdrant", e.message);
    }
  }
}

clean().then(() => process.exit(0));
