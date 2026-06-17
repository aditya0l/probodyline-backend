import re

def update_pdf_service(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    old_client_info = """      // Client Info
      clientName: customer?.name || quotation.clientName || undefined,
      clientAddress: customer?.address || quotation.clientAddress || undefined,
      clientAddressLine2: customer?.addressLine2 || quotation.clientAddressLine2 || undefined,
      clientCity: customer?.city || quotation.clientCity || undefined,
      gymName: customer?.gymName || quotation.gymName || undefined,
      gymArea: customer?.area || quotation.gymArea || undefined,
      clientGST: customer?.gst || quotation.clientGST || undefined,
      clientPanCard: customer?.panCard || quotation.clientPanCard || undefined,
      clientAadharCard: customer?.aadharCard || quotation.clientAadharCard || undefined,"""

    new_client_info = """      // Multiple Clients Logic
      hasMultipleClients: quotation.clients && quotation.clients.length > 1,
      client1Name: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].name : (customer?.name || quotation.clientName || undefined),
      client1Address: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].address : (customer?.address || quotation.clientAddress || undefined),
      client1AddressLine2: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].addressLine2 : (customer?.addressLine2 || quotation.clientAddressLine2 || undefined),
      client1City: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].city : (customer?.city || quotation.clientCity || undefined),
      client1GST: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].gst : (customer?.gst || quotation.clientGST || undefined),
      client1PanCard: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].panCard : (customer?.panCard || quotation.clientPanCard || undefined),
      client1AadharCard: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].aadharCard : (customer?.aadharCard || quotation.clientAadharCard || undefined),

      client2Name: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].name : undefined,
      client2Address: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].address : undefined,
      client2AddressLine2: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].addressLine2 : undefined,
      client2City: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].city : undefined,
      client2GST: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].gst : undefined,
      client2PanCard: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].panCard : undefined,
      client2AadharCard: quotation.clients && quotation.clients.length > 1 ? quotation.clients[1].aadharCard : undefined,

      // Client Info (Default)
      clientName: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].name : (customer?.name || quotation.clientName || undefined),
      clientAddress: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].address : (customer?.address || quotation.clientAddress || undefined),
      clientAddressLine2: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].addressLine2 : (customer?.addressLine2 || quotation.clientAddressLine2 || undefined),
      clientCity: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].city : (customer?.city || quotation.clientCity || undefined),
      gymName: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].gymName : (customer?.gymName || quotation.gymName || undefined),
      gymArea: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].area : (customer?.area || quotation.gymArea || undefined),
      clientGST: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].gst : (customer?.gst || quotation.clientGST || undefined),
      clientPanCard: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].panCard : (customer?.panCard || quotation.clientPanCard || undefined),
      clientAadharCard: quotation.clients && quotation.clients.length > 0 ? quotation.clients[0].aadharCard : (customer?.aadharCard || quotation.clientAadharCard || undefined),"""

    content = content.replace(old_client_info, new_client_info)
    
    with open(filepath, "w") as f:
        f.write(content)

update_pdf_service("src/pdf/pdf.service.ts")
