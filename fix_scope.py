import re

def fix_scope(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Define hasMultipleClients before return
    if "const hasMultipleClients =" not in content:
        old_return = """    const showField = (field: string) => {
      if (visibleClientFields && visibleClientFields.length > 0) {
        return visibleClientFields.includes(field);
      }
      return true;
    };

    const templateData = {"""
        
        new_return = """    const showField = (field: string) => {
      if (visibleClientFields && visibleClientFields.length > 0) {
        return visibleClientFields.includes(field);
      }
      return true;
    };

    const hasMultipleClients = quotation.clients && quotation.clients.length > 1;

    const templateData = {"""
        
        content = content.replace(old_return, new_return)
        
        # Now remove `hasMultipleClients: quotation.clients && quotation.clients.length > 1,` from object literal
        content = content.replace("hasMultipleClients: quotation.clients && quotation.clients.length > 1,", "hasMultipleClients,")
        
        with open(filepath, "w") as f:
            f.write(content)

fix_scope("src/pdf/pdf.service.ts")
