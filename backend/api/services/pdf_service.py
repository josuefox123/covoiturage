import os
from fpdf import FPDF
from django.conf import settings

class ZemyPDF(FPDF):
    def __init__(self, title_text="DOCUMENT ZEMY", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.title_text = title_text

    def header(self):
        # Top banner in Zemy Green (#10B981)
        self.set_fill_color(16, 185, 129)
        self.rect(0, 0, 210, 15, "F")
        
        # Banner Text
        self.set_text_color(255, 255, 255)
        self.set_font("helvetica", "B", 10)
        self.set_y(4)
        self.cell(0, 6, "PLATEFORME DE COVOITURAGE DYNAMIQUE ZEMY", 0, 0, "C")
        self.ln(15)

    def footer(self):
        # Footer background band in light gray
        self.set_y(-25)
        self.set_fill_color(243, 244, 246)
        self.rect(0, 275, 210, 22, "F")
        self.set_y(-18)
        self.set_font("helvetica", "B", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 4, "ZEMY COVOITURAGE - Plateforme Solidaire et Écologique", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("helvetica", "", 7)
        self.cell(0, 4, "Email: contact@zemy-app.com | Web: www.zemy-app.com", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 4, "Voyagez en toute sécurité et à prix partagé avec Zemy !", align="C")

def generate_passenger_receipt(booking) -> bytes:
    """
    Génère un reçu de paiement PDF au format A4 pour le passager.
    """
    pdf = ZemyPDF(title_text="REÇU DE PAIEMENT")
    pdf.add_page()
    
    # 1. LOGO & TITRE
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'logozemy.png')
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=15, y=25, w=35)
    
    pdf.set_y(25)
    pdf.set_font("helvetica", "B", 20)
    pdf.set_text_color(16, 185, 129) # Zemy Green
    pdf.cell(0, 10, "REÇU DE PAIEMENT", align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(107, 114, 128) # Gray
    pdf.cell(0, 5, f"Référence Booking : #{str(booking.id)[:8].upper()}", align="R", new_x="LMARGIN", new_y="NEXT")
    
    # Date du jour
    import datetime
    today = datetime.datetime.now().strftime("%d/%m/%Y à %H:%M")
    pdf.cell(0, 5, f"Généré le : {today}", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(15)
    
    # 2. STATUS BADGE
    pdf.set_fill_color(240, 253, 244) # Light green
    pdf.set_draw_color(74, 222, 128) # Green border
    pdf.rect(15, pdf.get_y(), 180, 12, "DF")
    pdf.set_y(pdf.get_y() + 3)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(22, 163, 74) # Dark green
    pdf.cell(0, 6, "   STATUT DU PAIEMENT : RÉUSSI / ENREGISTRÉ", align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    
    # 3. PASSENGER & DRIVER SECTIONS (SIDE-BY-SIDE CARDS)
    start_y = pdf.get_y()
    
    # PASSENGER CARD
    pdf.set_fill_color(249, 250, 251)
    pdf.set_draw_color(229, 231, 235)
    pdf.rect(15, start_y, 87, 45, "DF")
    pdf.set_y(start_y + 4)
    pdf.set_x(18)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(16, 185, 129)
    pdf.cell(0, 6, "INFORMATIONS DU PASSAGER", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 5, f"Nom : {booking.passenger.full_name or 'Passager Zemy'}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.set_font("helvetica", "", 9)
    pdf.cell(0, 5, f"Téléphone : {booking.passenger.phone}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, f"Email : {booking.passenger.email or 'Non renseigné'}", new_x="LMARGIN", new_y="NEXT")
    
    # DRIVER CARD
    pdf.rect(108, start_y, 87, 45, "DF")
    pdf.set_y(start_y + 4)
    pdf.set_x(111)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(16, 185, 129)
    pdf.cell(0, 6, "INFORMATIONS DU CONDUCTEUR", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(111)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(0, 5, f"Nom : {booking.ride.driver.full_name or 'Conducteur Zemy'}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(111)
    pdf.set_font("helvetica", "", 9)
    pdf.cell(0, 5, f"Téléphone : {booking.ride.driver.phone}", new_x="LMARGIN", new_y="NEXT")
    # Vehicle
    vehicle = booking.ride.vehicle
    vehicle_str = f"{vehicle.color} {vehicle.brand_model} ({vehicle.license_plate})" if vehicle else "Non renseigné"
    pdf.set_x(111)
    pdf.cell(0, 5, f"Véhicule : {vehicle_str}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_y(start_y + 50)
    pdf.ln(5)
    
    # 4. RIDE DETAILS CARD (FULL WIDTH)
    start_y2 = pdf.get_y()
    pdf.rect(15, start_y2, 180, 38, "DF")
    pdf.set_y(start_y2 + 3)
    pdf.set_x(18)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(16, 185, 129)
    pdf.cell(0, 6, "DÉTAILS DU TRAJET PUBLIÉ", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(31, 41, 55)
    pdf.set_x(18)
    pdf.cell(0, 5, f"Départ : {booking.departure_location}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, f"Destination : {booking.arrival_location}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    # Formatting date
    ride_date = booking.ride.departure_date.strftime("%d/%m/%Y") if hasattr(booking.ride.departure_date, 'strftime') else str(booking.ride.departure_date)
    pdf.cell(0, 5, f"Date de départ : Le {ride_date} à {str(booking.ride.departure_time)[:5]}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_y(start_y2 + 43)
    pdf.ln(5)
    
    # 5. TRANSACTION DETAIL TABLE
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(16, 185, 129)
    pdf.cell(0, 6, "DÉTAILS DE LA FACTURATION", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    
    # Table Header
    pdf.set_fill_color(229, 231, 235)
    pdf.set_font("helvetica", "B", 9)
    pdf.set_text_color(55, 65, 81)
    
    pdf.cell(100, 8, "Description", 1, 0, "L", True)
    pdf.cell(30, 8, "Prix Unitaire", 1, 0, "C", True)
    pdf.cell(20, 8, "Places", 1, 0, "C", True)
    pdf.cell(30, 8, "Total (FCFA)", 1, 1, "R", True)
    
    # Table Body
    pdf.set_font("helvetica", "", 9)
    pdf.set_text_color(31, 41, 55)
    
    # Price
    price_per_seat = booking.passenger_proposed_price or booking.ride.price_per_seat or 0
    total_fare = price_per_seat * booking.seats_booked
    
    pdf.cell(100, 8, f"Réservation Trajet : {booking.departure_location.split(',')[0]} -> {booking.arrival_location.split(',')[0]}", 1, 0, "L")
    pdf.cell(30, 8, f"{price_per_seat} FCFA", 1, 0, "C")
    pdf.cell(20, 8, str(booking.seats_booked), 1, 0, "C")
    pdf.cell(30, 8, f"{total_fare} FCFA", 1, 1, "R")
    
    # Total row
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(150, 9, "MONTANT TOTAL PAYÉ", 1, 0, "R", True)
    pdf.cell(30, 9, f"{total_fare} FCFA", 1, 1, "R", True)
    
    pdf.ln(10)
    
    # 6. SIGNATURE BLOCK OR SEAL
    pdf.set_font("helvetica", "I", 8)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 4, "Ce reçu électronique est généré automatiquement par la plateforme Zemy et sert de preuve légale de paiement.", align="C")
    
    return bytes(pdf.output())

def generate_driver_confirmation(booking) -> bytes:
    """
    Génère une reconnaissance de réservation PDF au format A4 pour le conducteur.
    """
    pdf = ZemyPDF(title_text="RECONNAISSANCE DE RÉSERVATION")
    pdf.add_page()
    
    # 1. LOGO & TITRE
    logo_path = os.path.join(settings.BASE_DIR, 'static', 'logozemy.png')
    if os.path.exists(logo_path):
        pdf.image(logo_path, x=15, y=25, w=35)
    
    pdf.set_y(25)
    pdf.set_font("helvetica", "B", 18)
    pdf.set_text_color(16, 185, 129) # Zemy Green
    pdf.cell(0, 10, "RECONNAISSANCE DE RÉSERVATION", align="R", new_x="LMARGIN", new_y="NEXT")
    
    # Unique Validation ticket code
    ticket_code = f"T-{str(booking.id)[:8].upper()}"
    
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 5, f"Code de Validation : {ticket_code}", align="R", new_x="LMARGIN", new_y="NEXT")
    
    import datetime
    today = datetime.datetime.now().strftime("%d/%m/%Y à %H:%M")
    pdf.cell(0, 5, f"Date d'émission : {today}", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(15)
    
    # 2. STATUS BADGE
    pdf.set_fill_color(240, 253, 244)
    pdf.set_draw_color(74, 222, 128)
    pdf.rect(15, pdf.get_y(), 180, 12, "DF")
    pdf.set_y(pdf.get_y() + 3)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(22, 163, 74)
    pdf.cell(0, 6, "   RÉSERVATION CONFIRMÉE & SÉCURISÉE", align="L", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(10)
    
    # 3. DETAILS CARD
    start_y = pdf.get_y()
    pdf.set_fill_color(249, 250, 251)
    pdf.set_draw_color(229, 231, 235)
    pdf.rect(15, start_y, 180, 60, "DF")
    
    pdf.set_y(start_y + 4)
    pdf.set_x(18)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(16, 185, 129)
    pdf.cell(0, 6, "RÉCAPITULATIF DE LA RÉSERVATION PASSAGER", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 10)
    pdf.set_text_color(31, 41, 55)
    
    pdf.set_x(18)
    pdf.cell(0, 5, f"Passager : {booking.passenger.full_name or 'Membre Zemy'}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, f"Téléphone du passager : {booking.passenger.phone}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, f"Itinéraire Passager : {booking.departure_location} ➔ {booking.arrival_location}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, f"Nombre de places réservées : {booking.seats_booked} place(s)", new_x="LMARGIN", new_y="NEXT")
    
    price_per_seat = booking.passenger_proposed_price or booking.ride.price_per_seat or 0
    total_price = price_per_seat * booking.seats_booked
    pdf.set_x(18)
    pdf.cell(0, 5, f"Prix total convenu : {total_price} FCFA", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_y(start_y + 65)
    pdf.ln(5)
    
    # 4. HOW TO VALIDATE SECTION (INSTRUCTION BOX)
    start_y2 = pdf.get_y()
    pdf.set_fill_color(255, 251, 235) # Light amber
    pdf.set_draw_color(245, 158, 11) # Amber border
    pdf.rect(15, start_y2, 180, 42, "DF")
    
    pdf.set_y(start_y2 + 3)
    pdf.set_x(18)
    pdf.set_font("helvetica", "B", 11)
    pdf.set_text_color(180, 83, 9) # Amber dark
    pdf.cell(0, 6, "INSTRUCTIONS DE VALIDATION DE L'EMBARQUEMENT", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_font("helvetica", "", 9.5)
    pdf.set_text_color(31, 41, 55)
    pdf.set_x(18)
    pdf.cell(0, 5, "Lors de la prise en charge du passager à son point de montée :", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, "1. Scannez le QR Code de son billet depuis votre application mobile conducteur.", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(18)
    pdf.cell(0, 5, f"2. Ou saisissez manuellement son code de validation unique ci-dessous :", new_x="LMARGIN", new_y="NEXT")
    
    # Manual Validation Code highlight box
    pdf.set_y(start_y2 + 48)
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(220, 38, 38) # Red validation code
    pdf.cell(0, 10, f"CODE TICKET : {ticket_code}", align="C", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(12)
    
    # 5. FOOTER NOTICE
    pdf.set_font("helvetica", "I", 8.5)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 4, "Ce billet de reconnaissance confirme que le passager s'est acquitté du montant du trajet sur Zemy.", align="C")
    
    return bytes(pdf.output())
