from django.db import migrations

def populate_complete_places(apps, schema_editor):
    PopularPlace = apps.get_model('api', 'PopularPlace')
    # Clear existing popular places to avoid duplicates
    PopularPlace.objects.all().delete()
    
    places = [
        {"name": "Étoile Rouge", "latitude": 6.3686, "longitude": 2.4172, "city": "Cotonou"},
        {"name": "Ganhi", "latitude": 6.3575, "longitude": 2.4289, "city": "Cotonou"},
        {"name": "Marché Dantokpa", "latitude": 6.3678, "longitude": 2.4348, "city": "Cotonou"},
        {"name": "Cadjèhoun", "latitude": 6.3558, "longitude": 2.4042, "city": "Cotonou"},
        {"name": "Aéroport de Cotonou", "latitude": 6.3533, "longitude": 2.3854, "city": "Cotonou"},
        {"name": "Fidjrossè", "latitude": 6.3592, "longitude": 2.3684, "city": "Cotonou"},
        {"name": "Agla", "latitude": 6.3762, "longitude": 2.3721, "city": "Cotonou"},
        {"name": "Houéyiho", "latitude": 6.3711, "longitude": 2.3925, "city": "Cotonou"},
        {"name": "Akpakpa", "latitude": 6.3725, "longitude": 2.4578, "city": "Cotonou"},
        {"name": "Pk3", "latitude": 6.3776, "longitude": 2.4468, "city": "Cotonou"},
        {"name": "Pk10", "latitude": 6.3794, "longitude": 2.5184, "city": "Cotonou"},
        {"name": "UAC", "latitude": 6.4174, "longitude": 2.3483, "city": "Abomey-Calavi"},
        {"name": "Carrefour IITA", "latitude": 6.4258, "longitude": 2.3387, "city": "Abomey-Calavi"},
        {"name": "Tokan", "latitude": 6.4531, "longitude": 2.3163, "city": "Abomey-Calavi"},
        {"name": "Womey", "latitude": 6.4215, "longitude": 2.3082, "city": "Abomey-Calavi"},
        {"name": "Carrefour Tankpè", "latitude": 6.4385, "longitude": 2.3551, "city": "Abomey-Calavi"},
        {"name": "Bidossessi", "latitude": 6.4152, "longitude": 2.3548, "city": "Abomey-Calavi"},
        {"name": "Arconville", "latitude": 6.4468, "longitude": 2.3444, "city": "Abomey-Calavi"},
        {"name": "Kpota", "latitude": 6.4098, "longitude": 2.3392, "city": "Abomey-Calavi"},
        {"name": "Godomey", "latitude": 6.3797, "longitude": 2.3353, "city": "Abomey-Calavi"},
        {"name": "Abomey-Calavi Centre", "latitude": 6.4478, "longitude": 2.3524, "city": "Abomey-Calavi"},
    ]
    for p in places:
        PopularPlace.objects.get_or_create(
            name=p["name"],
            latitude=p["latitude"],
            longitude=p["longitude"],
            city=p["city"]
        )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0029_popularplace'),
    ]

    operations = [
        migrations.RunPython(populate_complete_places),
    ]
