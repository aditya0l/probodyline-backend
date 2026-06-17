import re

def update_pdf_service(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # We need to change the visibility flags in pdf.service.ts
    old_flags = """      // Client Info visibility flags
      showClientNameField: true,
      showAddressLine1Field: showField('addressLine1'),
      showAddressLine2Field: showField('addressLine2'),
      showCityField: showField('city'),
      showGstNoField: showField('gstNo'),
      showBookingDateField: showField('bookingDate'),
      showDispatchDateField: showField('dispatchDate'),
      showPanCardField: showField('panCard'),
      showAadharCardField: showField('aadharCard'),"""

    new_flags = """      // Client Info visibility flags
      showClientNameField: !hasMultipleClients,
      showAddressLine1Field: !hasMultipleClients && showField('addressLine1'),
      showAddressLine2Field: !hasMultipleClients && showField('addressLine2'),
      showCityField: !hasMultipleClients && showField('city'),
      showGstNoField: !hasMultipleClients && showField('gstNo'),
      showBookingDateField: showField('bookingDate'),
      showDispatchDateField: showField('dispatchDate'),
      showPanCardField: !hasMultipleClients && showField('panCard'),
      showAadharCardField: !hasMultipleClients && showField('aadharCard'),"""

    # We also need to define hasMultipleClients before these lines if it's not defined in local scope, 
    # but wait, `hasMultipleClients` is inside the object literal!
    # I can't reference it inside the same object literal without defining it outside.
    
    # Let's fix that!
    with open(filepath, "w") as f:
        f.write(content.replace(old_flags, new_flags))

update_pdf_service("src/pdf/pdf.service.ts")
