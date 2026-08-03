import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def get_valid_callback_url(request, path):
    """
    Construit une URL absolue pour le callback. Si le serveur tourne en local, 
    utilise nip.io pour tromper FedaPay, sinon retourne l'URL de base dynamique.
    """
    import re
    from urllib.parse import urlparse, urlunparse
    
    custom_backend_url = os.environ.get('BACKEND_URL')
    
    if custom_backend_url:
        return custom_backend_url.rstrip('/') + path

    uri = request.build_absolute_uri(path)
    parsed = urlparse(uri)
    netloc = parsed.netloc
    
    if ':' in netloc:
        host, port = netloc.split(':', 1)
    else:
        host = netloc
        port = None

    is_local = (
        host == 'localhost' or 
        host == '127.0.0.1' or 
        host.startswith('192.168.') or 
        host.startswith('10.') or 
        host.startswith('172.16.')
    )
    
    if is_local:
        local_ip = host
        if host == 'localhost':
            local_ip = '127.0.0.1'
        nip_host = f"{local_ip}.nip.io"
        if port:
            nip_host = f"{nip_host}:{port}"
        
        new_parsed = parsed._replace(netloc=nip_host)
        return urlunparse(new_parsed)
        
    return uri

def send_zemy_reset_email(full_name, email, code):
    subject = "Réinitialisation de votre mot de passe Zemy"
    
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{subject}</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #F8FAFC;
                color: #0F172A;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }}
            .container {{
                max-width: 580px;
                margin: 30px auto;
                background: #FFFFFF;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                border: 1px solid #E2E8F0;
            }}
            .header {{
                text-align: center;
                margin-bottom: 30px;
            }}
            .logo-image {{
                height: 50px;
                vertical-align: middle;
                display: inline-block;
            }}
            .brand-name {{
                font-size: 28px;
                font-weight: 800;
                color: #0F172A;
                letter-spacing: 0.5px;
                vertical-align: middle;
                display: inline-block;
                margin-left: 8px;
            }}
            .logo-tagline {{
                font-size: 12px;
                color: #94A3B8;
                font-weight: 500;
                letter-spacing: 0.5px;
                margin-top: 8px;
            }}
            h1 {{
                font-size: 20px;
                font-weight: 700;
                color: #0F172A;
                margin-top: 0;
                margin-bottom: 20px;
            }}
            p {{
                font-size: 15px;
                line-height: 24px;
                color: #475569;
                margin-bottom: 20px;
            }}
            .otp-container {{
                background-color: #F1F5F9;
                border-radius: 14px;
                padding: 24px;
                text-align: center;
                margin: 25px 0;
                border: 1px solid #E2E8F0;
            }}
            .otp-code {{
                font-size: 32px;
                font-weight: 800;
                letter-spacing: 6px;
                color: #2563EB;
                margin: 0;
            }}
            .warning-text {{
                font-size: 13px;
                color: #94A3B8;
                line-height: 20px;
            }}
            .footer {{
                margin-top: 35px;
                border-top: 1px solid #E2E8F0;
                padding-top: 25px;
                text-align: center;
            }}
            .footer-brand {{
                font-weight: 700;
                color: #0F172A;
                font-size: 14px;
                margin-bottom: 4px;
            }}
            .footer-tagline {{
                font-size: 12px;
                color: #94A3B8;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="display: inline-block; vertical-align: middle;">
                    <img src="cid:logo_zemy" class="logo-image" alt="Logo Zemy" />
                  
                </div>
                <div class="logo-tagline" style="margin-top: 4px;">Transport & covoiturage</div>
            </div>
            
            <h1>Bonjour {full_name},</h1>
            
            <p>Nous avons reçu une demande de réinitialisation de votre mot de passe Zemy.</p>
            
            <p>Votre code de vérification est :</p>
            
            <div class="otp-container">
                <div class="otp-code">{code}</div>
            </div>
            
            <p>Ce code est valable pendant <strong>10 minutes</strong>.</p>
            
            <p class="warning-text">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
            
            <p>Merci de votre confiance.</p>
            
            <div class="footer">
                <div class="footer-brand">L'équipe Zemy</div>
                <div class="footer-tagline">Transport • Livraison • Mobilité</div>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_message = f"""Bonjour {full_name},

Nous avons reçu une demande de réinitialisation de votre mot de passe Zemy.

Votre code de vérification est :

{code}

Ce code est valable pendant 10 minutes.

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.

Merci de votre confiance.

L'équipe Zemy
Transport • Livraison • Mobilité"""

    try:
        from django.core.mail import EmailMultiAlternatives
        from email.mime.image import MIMEImage

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email]
        )
        msg.attach_alternative(html_message, "text/html")

        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logozemy.png')
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as f:
                img_data = f.read()
                image = MIMEImage(img_data)
                image.add_header('Content-ID', '<logo_zemy>')
                image.add_header('Content-Disposition', 'inline', filename='logozemy.png')
                msg.attach(image)
        else:
            logger.warning(f"Fichier logo non trouvé à l'emplacement : {logo_path}")

        msg.send(fail_silently=False)
        logger.info(f"Email OTP de réinitialisation de mot de passe envoyé avec succès à {email}")
        return True
    except Exception as e:
        logger.error(f"Échec de l'envoi de l'email OTP à {email} : {str(e)}")
        raise e
