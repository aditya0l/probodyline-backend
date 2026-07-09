import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentParserService {

  parsePANCard(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // PAN number: 10 chars, format ABCDE1234F
    const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/g;
    const panMatches = rawText.match(panRegex);
    if (panMatches?.length) {
      result.panCardNumber = panMatches[0];
    }

    // Name on PAN card — usually appears after "Name" label
    // or on the line before the PAN number
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      // Indian PAN cards often have bilingual labels (e.g., "नाम / Name")
      // AWS Textract often corrupts the Hindi part to things like "714 1 Name"
      if ((line.endsWith('name') || line.endsWith('name:')) && !line.includes('father')) {
        if (lines[i + 1]) {
          result.nameAsPanCard = lines[i + 1];
          break;
        }
      }
    }

    // From key-value pairs if available
    if (kvPairs['name']) result.nameAsPanCard = kvPairs['name'];
    if (kvPairs['permanent account number']) {
      result.panCardNumber = kvPairs['permanent account number'];
    }

    return result;
  }

  parseAadharCard(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // Aadhar number: 12 digits, usually in format XXXX XXXX XXXX
    const aadharRegex = /\b\d{4}[ \t]+\d{4}[ \t]+\d{4}\b/g;
    const aadharMatches = rawText.match(aadharRegex);
    if (aadharMatches?.length) {
      result.aadharCardNumber = aadharMatches[0].replace(/\s/g, '');
    }

    // Name — on Aadhar, the true name is almost always the line exactly above the DOB line
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const dobIndex = lines.findIndex(l => /(?:DOB|Date of Birth|DOB\s*:|Date of Birth\s*:|YOB)/i.test(l) || /\d{2}\/\d{2}\/\d{4}/.test(l));
    
    if (dobIndex > 0) {
      // The line before DOB is the name
      result.nameAsAadharCard = lines[dobIndex - 1];
    } else {
      // Fallback to old heuristic if DOB not found
      for (const line of lines) {
        if (
          /^[A-Za-z\s]{3,50}$/.test(line) &&
          !line.toLowerCase().includes('government') &&
          !line.toLowerCase().includes('india') &&
          !line.toLowerCase().includes('aadhaar') &&
          line.split(' ').length >= 2
        ) {
          result.nameAsAadharCard = line;
          break;
        }
      }
    }

    // Date of Birth
    const dobRegex = /(?:DOB|Date of Birth)[:\s]+(\d{2}\/\d{2}\/\d{4})/i;
    const dobMatch = rawText.match(dobRegex);
    if (dobMatch) result.dateOfBirth = dobMatch[1];

    // Address — Check KV pairs first as Textract often parses it cleanly
    const addressKey = Object.keys(kvPairs).find(k => k.includes('address'));
    if (addressKey && kvPairs[addressKey]) {
      let address = kvPairs[addressKey];
      // Strip relative name (S/O, W/O, D/O, C/O) from the beginning of the address if present
      const nameMatch = rawText.match(/(?:S\/O|W\/O|D\/O|C\/O)[\s:]+([A-Za-z\s\.]+)/i);
      if (nameMatch) {
        const relativeName = nameMatch[1].trim();
        const regex = new RegExp(`^${relativeName}[,\\s]*`, 'i');
        address = address.replace(regex, '');
      }
      result.addressAsAadharCard = address;
    } else {
      // Fallback to raw text regex
      const addressRegex = /(?:Address|S\/O|W\/O|D\/O)[:\s]+(.+?)(?=\d{4}\s\d{4}|\d{6}|$)/is;
      const addressMatch = rawText.match(addressRegex);
      if (addressMatch) {
        result.addressAsAadharCard = addressMatch[1]
          .replace(/\n/g, ', ')
          .trim();
      }
    }

    return result;
  }

  parseGSTCertificate(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // GST Number: 15 chars
    const gstRegex = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/g;
    const gstMatches = rawText.match(gstRegex);
    if (gstMatches?.length) {
      result.gstRegistrationNumber = gstMatches[0];
    }

    // Legal & Trade name using line-based parsing
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('legal name')) {
        if (lines[i + 1]) result.legalName = lines[i + 1];
      }
      if (line.includes('trade name')) {
        if (lines[i + 1]) result.tradeName = lines[i + 1];
      }
    }

    // From key-value pairs
    if (kvPairs['legal name of business']) {
      result.legalName = kvPairs['legal name of business'];
    }
    if (kvPairs['trade name']) {
      result.tradeName = kvPairs['trade name'];
    }
    if (kvPairs['principal place of business']) {
      result.principalAddress = kvPairs['principal place of business'];
    }
    if (kvPairs['additional place of business']) {
      result.additionalPlacesOfBusiness = 
        kvPairs['additional place of business'];
    }

    return result;
  }

  parseRentAgreement(rawText: string, kvPairs: Record<string, string>) {
    // Rent agreement has no standard format
    // Just return raw text for manual review
    return { rawText: rawText.substring(0, 500) };
  }

  parseBankCheque(rawText: string, kvPairs: Record<string, string>) {
    const result: Record<string, string> = {};

    // Account number — 9-18 digits
    const accRegex = /(?:A\/C|Account|Acc)[.\s#:]*(\d{9,18})/i;
    const accMatch = rawText.match(accRegex);
    if (accMatch) result.accountNumber = accMatch[1];

    // IFSC: 11 chars starting with 4 letters
    const ifscRegex = /[A-Z]{4}0[A-Z0-9]{6}/g;
    const ifscMatches = rawText.match(ifscRegex);
    if (ifscMatches?.length) {
      result.ifscCode = ifscMatches[0];
      result.branchCode = ifscMatches[0].slice(-6); // Branch code is last 6 characters of IFSC
    }

    // Bank name from key-value pairs
    if (kvPairs['bank']) result.bankName = kvPairs['bank'];
    if (kvPairs['bank name']) result.bankName = kvPairs['bank name'];
    if (kvPairs['branch']) result.branchName = kvPairs['branch'];

    return result;
  }

  // Route to correct parser based on document type
  parseDocument(
    documentType: string,
    rawText: string,
    kvPairs: Record<string, string>
  ) {
    switch (documentType) {
      case 'PAN_CARD_CLIENT':
      case 'PAN_CARD_FIRM':
        return this.parsePANCard(rawText, kvPairs);
      case 'AADHAR_CARD':
        return this.parseAadharCard(rawText, kvPairs);
      case 'GST_CERTIFICATE':
        return this.parseGSTCertificate(rawText, kvPairs);
      case 'RENT_AGREEMENT':
        return this.parseRentAgreement(rawText, kvPairs);
      case 'BANK_DETAILS':
        return this.parseBankCheque(rawText, kvPairs);
      default:
        return {};
    }
  }
}
