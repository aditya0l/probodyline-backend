const fs = require('fs');
let code = fs.readFileSync('src/pdf/pdf.service.ts', 'utf8');

const targetStr = "clientName: quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].name || undefined) : (customer?.name || quotation.clientName || undefined),";

const replacementStr = `      clientName: await (async () => {
        let code = quotation.clients && quotation.clients.length > 0 ? (quotation.clients[0].name || undefined) : (customer?.name || quotation.clientName || undefined);
        if (code) {
          try {
            const clientRec = await this.prisma.client.findFirst({ where: { clientCode: code } });
            if (clientRec && clientRec.clientName) return clientRec.clientName;
          } catch (e) {}
        }
        return code;
      })(),`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('src/pdf/pdf.service.ts', code);
  console.log("Patched clientName mapping!");
} else {
  console.log("Target string not found.");
}
