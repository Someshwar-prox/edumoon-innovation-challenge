const fs = require('fs');
const path = require('path');

const modules = [
  'auth', 'business', 'business-settings', 'analytics', 'audit'
];

modules.forEach(mod => {
  const dir = path.join(__dirname, 'src', mod);
  
  // Routes
  const routeContent = `import { Router } from 'express';\nimport { ${mod.replace(/-./g, x=>x[1].toUpperCase())}Controller } from '../controllers/${mod}.controller';\n\nconst router = Router();\n\nrouter.get('/', ${mod.replace(/-./g, x=>x[1].toUpperCase())}Controller.getAll || ((req, res) => res.json({})));\n\nexport default router;\n`;
  fs.writeFileSync(path.join(dir, 'routes', `${mod}.routes.ts`), routeContent);
  fs.writeFileSync(path.join(dir, 'routes', `index.ts`), `import router from './${mod}.routes';\nexport default router;\n`);

  // Controllers
  const ctrlContent = `import { Request, Response, NextFunction } from 'express';\n\nexport class ${mod.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('')}Controller {\n  async getAll(req: Request, res: Response, next: NextFunction) {\n    res.json({ message: '${mod} works' });\n  }\n}\nexport const ${mod.replace(/-./g, x=>x[1].toUpperCase())}Controller = new ${mod.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('')}Controller();\n`;
  fs.writeFileSync(path.join(dir, 'controllers', `${mod}.controller.ts`), ctrlContent);

  // Services
  const srvContent = `export class ${mod.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('')}Service {}\nexport const ${mod.replace(/-./g, x=>x[1].toUpperCase())}Service = new ${mod.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('')}Service();\n`;
  fs.writeFileSync(path.join(dir, 'services', `${mod}.service.ts`), srvContent);
});

console.log('Scaffolding complete.');
