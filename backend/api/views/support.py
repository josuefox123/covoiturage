import logging
import datetime
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.utils.html import strip_tags

from ..models import SupportTicket
from ..serializers import SupportTicketSerializer

logger = logging.getLogger('api')

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def send_support_emails(ticket):
    category_label = {
        'problem_ride': 'Problème de trajet',
        'problem_parcel': 'Problème de colis',
        'payment': 'Paiement',
        'account': 'Compte',
        'driver': 'Conducteur',
        'suggestion': 'Suggestion',
        'other': 'Autre',
    }.get(ticket.category, 'Autre')
    
    date_str = ticket.created_at.strftime('%d/%m/%Y') if ticket.created_at else datetime.date.today().strftime('%d/%m/%Y')
    
    # 1. Email to zemy@sinustic.com
    support_subject = f"[Nouveau message Zemy] {category_label}"
    support_body = (
        "Nouvelle demande reçue depuis l'application Zemy.\n\n"
        f"Nom :\n{ticket.name}\n\n"
        f"Email :\n{ticket.email}\n\n"
        f"Catégorie :\n{category_label}\n\n"
        f"Sujet :\n{ticket.subject}\n\n"
        f"Message :\n\n{ticket.message}\n\n"
        "-----------------------------------\n\n"
        f"Date :\n{date_str}\n\n"
        "Application :\nZemy Mobile"
    )
    
    # 2. Email to user
    first_name = ticket.name.split(' ')[0] if ticket.name else 'Client'
    user_subject = "Votre demande a bien été reçue"
    user_body = (
        f"Bonjour {first_name},\n\n"
        "Nous avons bien reçu votre demande.\n\n"
        "Notre équipe reviendra vers vous dans les meilleurs délais.\n\n"
        "Numéro de suivi :\n"
        f"{ticket.ticket_number}\n\n"
        "Merci d'utiliser Zemy."
    )
    
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Zemy <noreply@zemy.app>')
    
    # Send to support
    try:
        send_mail(
            subject=support_subject,
            message=support_body,
            from_email=from_email,
            recipient_list=['zemy@sinustic.com'],
            fail_silently=False,
        )
        logger.info(f"Email de notification envoyé à zemy@sinustic.com pour le ticket {ticket.ticket_number}")
    except Exception as e:
        logger.error(f"Erreur d'envoi de l'email de notification support pour le ticket {ticket.ticket_number}: {str(e)}")
        
    # Send to user
    try:
        send_mail(
            subject=user_subject,
            message=user_body,
            from_email=from_email,
            recipient_list=[ticket.email],
            fail_silently=False,
        )
        logger.info(f"Email de confirmation envoyé à {ticket.email} pour le ticket {ticket.ticket_number}")
    except Exception as e:
        logger.error(f"Erreur d'envoi de l'email de confirmation à {ticket.email} pour le ticket {ticket.ticket_number}: {str(e)}")

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def contact_view(request):
    """
    Endpoint public pour l'envoi d'un message de support depuis le mobile.
    Route: POST /api/contact/
    """
    ip = get_client_ip(request)
    data = request.data.copy()
    
    # 1. Rate limiting check: limit to 5 messages per hour
    now = timezone.now()
    one_hour_ago = now - datetime.timedelta(hours=1)
    
    if request.user.is_authenticated:
        user_tickets_count = SupportTicket.objects.filter(user=request.user, created_at__gte=one_hour_ago).count()
        if user_tickets_count >= 5:
            logger.warning(f"Rate limit exceeded for authenticated user {request.user.phone}")
            return Response(
                {"detail": "Vous avez dépassé la limite de 5 messages de support par heure. Veuillez réessayer plus tard."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
    else:
        email = data.get('email', '')
        email_clean = strip_tags(email).strip()
        email_tickets_count = SupportTicket.objects.filter(email=email_clean, created_at__gte=one_hour_ago).count()
        ip_tickets_count = SupportTicket.objects.filter(ip_address=ip, created_at__gte=one_hour_ago).count() if ip else 0
        if email_tickets_count >= 5 or ip_tickets_count >= 5:
            logger.warning(f"Rate limit exceeded for IP {ip} or email {email_clean}")
            return Response(
                {"detail": "Vous avez dépassé la limite de 5 messages de support par heure pour cet e-mail ou cette adresse IP. Veuillez réessayer plus tard."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

    # 2. Deserialize & Validate
    serializer = SupportTicketSerializer(data=data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
    # 3. Associate authenticated user & IP, then Save
    ticket = serializer.save(
        user=request.user if request.user.is_authenticated else None,
        ip_address=ip
    )
    
    logger.info(f"Nouveau ticket de support créé: {ticket.ticket_number} (IP: {ip}, Catégorie: {ticket.category})")
    
    # 4. Trigger email sending
    send_support_emails(ticket)
    
    return Response(
        {
            "detail": "Votre demande a bien été envoyée. Notre équipe vous répondra par email dans les meilleurs délais.",
            "ticket_number": ticket.ticket_number
        },
        status=status.HTTP_201_CREATED
    )

class SupportTicketViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion des tickets de support par les administrateurs du Dashboard.
    Route: /api/support-tickets/
    """
    queryset = SupportTicket.objects.all()
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]
    
    @action(detail=True, methods=['POST'])
    def reply(self, request, pk=None):
        """
        Permet à un administrateur de répondre directement à un ticket.
        Envoie un e-mail à l'expéditeur et passe le statut à "Traité" (resolved).
        """
        ticket = self.get_object()
        reply_message = request.data.get('message', '').strip()
        
        if not reply_message:
            raise ValidationError({"message": "Le message de réponse ne peut pas être vide."})
            
        reply_message_clean = strip_tags(reply_message)
        
        first_name = ticket.name.split(' ')[0] if ticket.name else 'Client'
        reply_subject = f"Re: [Zemy Support] {ticket.subject}"
        reply_body = (
            f"Bonjour {first_name},\n\n"
            f"Notre équipe de support a répondu à votre demande concernant \"{ticket.subject}\".\n\n"
            "Réponse de l'équipe support :\n"
            "--------------------------------------------------\n"
            f"{reply_message_clean}\n"
            "--------------------------------------------------\n\n"
            "Rappel de votre demande originale :\n"
            f"Message :\n{ticket.message}\n\n"
            f"Numéro de suivi : {ticket.ticket_number}\n\n"
            "Merci d'utiliser Zemy."
        )
        
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Zemy <noreply@zemy.app>')
        
        # Send reply email
        try:
            send_mail(
                subject=reply_subject,
                message=reply_body,
                from_email=from_email,
                recipient_list=[ticket.email],
                fail_silently=False,
            )
            logger.info(f"Réponse envoyée par email à {ticket.email} pour le ticket {ticket.ticket_number}")
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de la réponse par email pour le ticket {ticket.ticket_number}: {str(e)}")
            return Response(
                {"detail": "Impossible d'envoyer l'e-mail de réponse. Veuillez vérifier la configuration SMTP."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
        # Update ticket status to resolved
        ticket.status = 'resolved'
        ticket.save()
        logger.info(f"Le statut du ticket {ticket.ticket_number} a été mis à jour à 'resolved' suite à la réponse de l'admin.")
        
        return Response(
            {
                "detail": "Réponse envoyée avec succès et statut du ticket mis à jour à 'Traité'.",
                "status": ticket.status
            },
            status=status.HTTP_200_OK
        )
