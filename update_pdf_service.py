import re

def update_pdf_service(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Find unique include replacement
    content = content.replace("customer: true,", "customer: true,\n        clients: true,")
    
    # Also update the type of quotation in generateQuotationHTML
    old_type = """  private async generateQuotationHTML(
    quotation: Quotation & {
      customer?: Customer | null;
      items: QuotationItem[];
    },"""
    new_type = """  private async generateQuotationHTML(
    quotation: Quotation & {
      customer?: Customer | null;
      clients?: Customer[];
      items: QuotationItem[];
    },"""
    content = content.replace(old_type, new_type)
    
    with open(filepath, "w") as f:
        f.write(content)

update_pdf_service("src/pdf/pdf.service.ts")
