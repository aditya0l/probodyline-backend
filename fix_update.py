import re

def fix_update(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    client_logic = """
        // Process multiple clients
        const clientIdsToConnect: string[] = [];
        if (data.clients && data.clients.length > 0) {
          for (const c of data.clients) {
            let customerId = c.id;
            
            if (customerId) {
              await tx.customer.update({
                where: { id: customerId },
                data: {
                  name: c.clientName?.trim() || 'Unknown',
                  phone: c.clientPhone?.trim() || '0000000000',
                  email: c.clientEmail?.trim() || null,
                  address: c.clientAddress,
                  addressLine2: c.clientAddressLine2,
                  city: c.clientCity,
                  panCard: c.clientPanCard?.trim() || null,
                  aadharCard: c.clientAadharCard?.trim() || null,
                  gst: c.clientGST?.trim() || null,
                  gymName: c.gymName,
                  area: c.gymArea,
                },
              });
            } else if (c.clientName || c.clientPhone || c.clientEmail) {
              const newCustomer = await tx.customer.create({
                data: {
                  name: c.clientName?.trim() || 'Unknown',
                  phone: c.clientPhone?.trim() || '0000000000',
                  email: c.clientEmail?.trim() || null,
                  address: c.clientAddress,
                  addressLine2: c.clientAddressLine2,
                  city: c.clientCity,
                  panCard: c.clientPanCard?.trim() || null,
                  aadharCard: c.clientAadharCard?.trim() || null,
                  gst: c.clientGST?.trim() || null,
                  gymName: c.gymName,
                  area: c.gymArea,
                },
              });
              customerId = newCustomer.id;
            }
            if (customerId) {
              clientIdsToConnect.push(customerId);
            }
          }
        }
"""

    # Inject into the transaction block (items present)
    content = content.replace(
        "const itemsToCreate = items!;",
        "const itemsToCreate = items!;\n" + client_logic
    )
    
    # Inject clientIdsToConnect into the quotation update (transaction)
    content = content.replace(
        """            items: {
              create: itemsToCreate""",
        """            clients: clientIdsToConnect.length > 0 ? {
              set: clientIdsToConnect.map(id => ({ id }))
            } : undefined,
            items: {
              create: itemsToCreate"""
    )
    
    # Now for the simple update without items. 
    # It doesn't use a transaction, so we use this.prisma.customer instead of tx.customer
    client_logic_simple = client_logic.replace("tx.customer", "this.prisma.customer")
    
    content = content.replace(
        "const result = await this.prisma.quotation.update({",
        client_logic_simple + "\n    const result = await this.prisma.quotation.update({"
    )
    
    # Inject clientIdsToConnect into the quotation update (simple)
    content = content.replace(
        """        leadName:
          updateData.leadName !== undefined ? updateData.leadName : undefined,""",
        """        leadName:
          updateData.leadName !== undefined ? updateData.leadName : undefined,
        clients: clientIdsToConnect.length > 0 ? {
          set: clientIdsToConnect.map(id => ({ id }))
        } : undefined,"""
    )

    with open(filepath, "w") as f:
        f.write(content)

fix_update("src/quotations/quotations.service.ts")
