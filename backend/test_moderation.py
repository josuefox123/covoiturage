from api.services.moderation_service import MessageModerator

test_cases = [
    "Salut, appelle-moi au +229 97 12 34 56.",
    "Mon WhatsApp est 97123456.",
    "97123456",
    "9 7 1 2 3 4 5 6",
    "neuf sept douze trente-quatre cinquante-six",
    "On se capte à la gare à 14h", # Should be accepted
    "Envoie un mail à test@example.com",
    "mon insta c'est @boss229",
    "Rejoins moi sur t.me/groupcovoit",
]

for tc in test_cases:
    res = MessageModerator.analyze_and_filter(tc)
    print(f"\nOriginal: {tc}")
    print(f"Status:   {res['status']}")
    print(f"Filtered: {res['filtered_content']}")
    print(f"Detected: {res['detected']}")
