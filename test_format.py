EXTRACTION_PROMPT = '''You are an expert Indian CA (Chartered Accountant) document analyzer.
Analyze the following document text and extract key financial information.

Return your response ONLY as a valid JSON object with these fields (use null for missing):
{{
  "document_type": "string",
  "financial_year": "string (e.g. 2024-2025)",
  "entity_name": "string",
  "pan": "string",
  "gstin": "string",
  "total_amount": "number or null",
  "tax_amount": "number or null",
  "key_fields": {{
    "any other important field": "value"
  }},
  "line_items": [
    {{ "description": "string", "amount": "number" }}
  ],
  "dates": ["list of important dates found"],
  "summary": "brief one-sentence summary of the document"
}}

Document text:
{text}'''

schema_fields_str = "    // You MUST extract these specific fields requested by the user.\\n"
base_prompt = EXTRACTION_PROMPT.replace('"key_fields": {{', f'"key_fields": {{{{\\n{schema_fields_str}')
print("Resulting prompt string structure looks OK")
try:
    res = base_prompt.format(text='my text')
    print('SUCCESS! Length:', len(res))
except Exception as e:
    import traceback
    traceback.print_exc()
