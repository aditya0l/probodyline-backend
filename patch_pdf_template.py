import re

def update_pdf_template(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    new_section = """      <!-- Multiple Clients Side-by-Side -->
      {{#if hasMultipleClients}}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <!-- Client 1 -->
        <div style="border: 1px solid var(--border-color); padding: 8px; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 8pt; margin-bottom: 5px; color: var(--text-secondary);">CLIENT 1</div>
          <div class="info-row"><div class="info-label">CLIENT NAME</div><div class="info-value">{{client1Name}}</div></div>
          {{#if showAddressLine1Field}}<div class="info-row"><div class="info-label">ADDRESS 1</div><div class="info-value">{{#if client1Address}}{{{client1Address}}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showAddressLine2Field}}<div class="info-row"><div class="info-label">ADDRESS 2</div><div class="info-value">{{#if client1AddressLine2}}{{{client1AddressLine2}}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showCityField}}<div class="info-row"><div class="info-label">CITY</div><div class="info-value">{{#if client1City}}{{client1City}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showGstNoField}}<div class="info-row"><div class="info-label">GST NO.</div><div class="info-value">{{#if client1GST}}{{client1GST}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showPanCardField}}<div class="info-row"><div class="info-label">PAN CARD</div><div class="info-value">{{#if client1PanCard}}{{client1PanCard}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showAadharCardField}}<div class="info-row"><div class="info-label">AADHAR CARD</div><div class="info-value">{{#if client1AadharCard}}{{client1AadharCard}}{{else}}—{{/if}}</div></div>{{/if}}
        </div>
        <!-- Client 2 -->
        <div style="border: 1px solid var(--border-color); padding: 8px; border-radius: 4px;">
          <div style="font-weight: 600; font-size: 8pt; margin-bottom: 5px; color: var(--text-secondary);">CLIENT 2</div>
          <div class="info-row"><div class="info-label">CLIENT NAME</div><div class="info-value">{{client2Name}}</div></div>
          {{#if showAddressLine1Field}}<div class="info-row"><div class="info-label">ADDRESS 1</div><div class="info-value">{{#if client2Address}}{{{client2Address}}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showAddressLine2Field}}<div class="info-row"><div class="info-label">ADDRESS 2</div><div class="info-value">{{#if client2AddressLine2}}{{{client2AddressLine2}}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showCityField}}<div class="info-row"><div class="info-label">CITY</div><div class="info-value">{{#if client2City}}{{client2City}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showGstNoField}}<div class="info-row"><div class="info-label">GST NO.</div><div class="info-value">{{#if client2GST}}{{client2GST}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showPanCardField}}<div class="info-row"><div class="info-label">PAN CARD</div><div class="info-value">{{#if client2PanCard}}{{client2PanCard}}{{else}}—{{/if}}</div></div>{{/if}}
          {{#if showAadharCardField}}<div class="info-row"><div class="info-label">AADHAR CARD</div><div class="info-value">{{#if client2AadharCard}}{{client2AadharCard}}{{else}}—{{/if}}</div></div>{{/if}}
        </div>
      </div>
      {{/if}}

      <div class="info-grid">"""

    # We replace `<div class="info-grid">` with the new section
    # Wait, there's `{{#if showClientNameField}}` immediately after.
    # If `hasMultipleClients` is true, we should probably hide the main clientName, address, city, gst etc. from the main grid!
    # So we wrap the existing client info in `{{#if hasMultipleClients}} ... {{else}} ... {{/if}}`
    
    # Or simpler: in pdf.service.ts, we can set `showClientNameField = !hasMultipleClients && showClientNameField` etc.
    # No, that's better logic!
    
    with open(filepath, "w") as f:
        f.write(content.replace('<div class="info-grid">', new_section))

update_pdf_template("src/pdf/templates/quotation-template.html")
