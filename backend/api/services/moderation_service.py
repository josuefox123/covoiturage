import re
import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException

class MessageModerator:
    # Regex for emails
    EMAIL_REGEX = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    
    # Regex for social links / messaging apps
    SOCIAL_LINKS_REGEX = r'(wa\.me|t\.me|telegram\.me|facebook\.com|fb\.me|ig\.me|instagram\.com|snapchat\.com/add|tiktok\.com/@[a-zA-Z0-9_.-]+)'
    
    # Regex to catch loose phone numbers with spaces, dots, dashes (min 8 digits)
    POTENTIAL_PHONE_REGEX = r'(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\d[\s.-]?){7,14}\d'
    
    # Regex for social keywords
    SOCIAL_KEYWORDS_REGEX = r'(?i)\b(whatsapp|telegram|insta|instagram|snapchat|facebook|tiktok)\b(?:\s+(?:est|c\'est|mon|le)?\s*@?[a-zA-Z0-9_.-]+)?'

    # Mapping of words to numbers for obfuscation check
    WORD_TO_NUM = {
        'zero': '0', 'zéro': '0',
        'un': '1', 'une': '1',
        'deux': '2',
        'trois': '3',
        'quatre': '4',
        'cinq': '5',
        'six': '6',
        'sept': '7',
        'huit': '8',
        'neuf': '9',
        'dix': '10',
        'onze': '11', 'douze': '12', 'treize': '13', 'quatorze': '14', 'quinze': '15',
        'seize': '16', 'vingt': '20', 'trente': '30', 'quarante': '40',
        'cinquante': '50', 'soixante': '60', 'quatre-vingt': '80', 'cent': '00',
        'trente-quatre': '34', 'cinquante-six': '56' # examples of composed
    }

    MASK = '[Coordonnée masquée]'

    @classmethod
    def analyze_and_filter(cls, content: str, default_region='BJ') -> dict:
        """
        Analyse le contenu d'un message pour détecter les informations personnelles
        et les masquer.
        """
        if not content:
            return {"status": "accepted", "filtered_content": content, "detected": []}
            
        original_content = content
        filtered_content = content
        detected_types = set()

        # 1. Obfuscation textuelle ("neuf sept douze")
        # Split on any non-word characters except dash
        words = re.findall(r'\b[a-zA-Zàâäéèêëîïôöùûüç-]+\b', filtered_content.lower())
        num_sequence = []
        for w in words:
            # handle 'trente-quatre' by splitting if not in dict
            sub_words = w.split('-') if '-' in w and w not in cls.WORD_TO_NUM else [w]
            for sw in sub_words:
                if sw in cls.WORD_TO_NUM:
                    num_sequence.append(cls.WORD_TO_NUM[sw])
        
        # Si on trouve une séquence de mots-nombres qui fait plus de 6 caractères au total
        if len(''.join(num_sequence)) >= 8:
            detected_types.add('phone_text')
            # Remplacer les séquences de mots nombres
            for word in sorted(cls.WORD_TO_NUM.keys(), key=len, reverse=True):
                 filtered_content = re.sub(r'(?i)\b' + word + r'\b', ' * ', filtered_content)
            
            # Reduce multiple stars
            filtered_content = re.sub(r'( \*\s*)+', ' ' + cls.MASK + ' ', filtered_content).strip()

        # 2. Extract potential phone numbers
        potential_phones = re.finditer(cls.POTENTIAL_PHONE_REGEX, original_content)
        for match in potential_phones:
            phone_str = match.group()
            # Clean up the string for libphonenumber
            clean_phone = re.sub(r'[\s.-]', '', phone_str)
            if not clean_phone.startswith('+') and not clean_phone.startswith('00'):
                # Try parsing with default region
                try:
                    parsed = phonenumbers.parse(clean_phone, default_region)
                    if phonenumbers.is_possible_number(parsed) or phonenumbers.is_valid_number(parsed):
                        filtered_content = filtered_content.replace(phone_str, cls.MASK)
                        detected_types.add('phone')
                except NumberParseException:
                    pass
            else:
                try:
                    parsed = phonenumbers.parse(phone_str, None)
                    if phonenumbers.is_possible_number(parsed) or phonenumbers.is_valid_number(parsed):
                        filtered_content = filtered_content.replace(phone_str, cls.MASK)
                        detected_types.add('phone')
                except NumberParseException:
                    pass

        # 3. Emails
        if re.search(cls.EMAIL_REGEX, filtered_content):
            filtered_content = re.sub(cls.EMAIL_REGEX, cls.MASK, filtered_content)
            detected_types.add('email')

        # 4. Social Links
        if re.search(cls.SOCIAL_LINKS_REGEX, filtered_content, re.IGNORECASE):
            filtered_content = re.sub(cls.SOCIAL_LINKS_REGEX, cls.MASK, filtered_content, flags=re.IGNORECASE)
            detected_types.add('social_link')
            
        # 5. Social Keywords (e.g. "mon whatsapp est...")
        # Be careful not to replace the word "whatsapp" alone if they are just asking "tu as whatsapp?"
        # We look for "whatsapp 97123456" which would have its number masked already, leaving "whatsapp [Coordonnée masquée]"
        # If the number is already masked, it's fine. 

        # Determine status
        status = "accepted"
        if detected_types:
            status = "modified"
            
            # Check if it should be blocked (content is ONLY masks and small words)
            clean_filtered = filtered_content.replace(cls.MASK, '').replace('*', '').strip()
            # If after removing masks, there's less than 3 meaningful characters left
            if len(re.sub(r'[^a-zA-Z0-9]', '', clean_filtered)) < 3:
                status = "blocked"
                filtered_content = "[Message bloqué pour non-respect des règles de communication]"

        return {
            "status": status,
            "filtered_content": filtered_content,
            "detected": list(detected_types)
        }
