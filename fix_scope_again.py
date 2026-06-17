import re

def fix_scope(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    old_template_data = "    const templateData = {"
    new_template_data = "    const hasMultipleClients = Boolean(quotation.clients && quotation.clients.length > 1);\n\n    const templateData = {"
    
    # We should also change `hasMultipleClients: hasMultipleClients,` to `hasMultipleClients,` if it's not already
    content = content.replace(old_template_data, new_template_data)
    
    with open(filepath, "w") as f:
        f.write(content)

fix_scope("src/pdf/pdf.service.ts")
