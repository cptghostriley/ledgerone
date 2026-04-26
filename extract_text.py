import zipfile
import xml.etree.ElementTree as ET
import sys

def read_docx(file_path):
    with zipfile.ZipFile(file_path, 'r') as z:
        xml_content = z.read('word/document.xml')
        
    tree = ET.fromstring(xml_content)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    text = []
    for paragraph in tree.findall('.//w:p', ns):
        para_text = []
        for run in paragraph.findall('.//w:r', ns):
            text_node = run.find('w:t', ns)
            if text_node is not None and text_node.text:
                para_text.append(text_node.text)
        if para_text:
            text.append(''.join(para_text))
            
    return '\n'.join(text)

if __name__ == "__main__":
    content = read_docx(sys.argv[1])
    with open("doc_output.txt", "w", encoding="utf-8") as f:
        f.write(content)
