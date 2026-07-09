import os

class HostOverrideMiddleware:
    """
    Middleware qui remplace le HTTP_HOST par le domaine de production 
    lorsque la requête passe par le reverse proxy Nginx (détecté via HTTP_X_FORWARDED_FOR).
    Cela permet à Django REST Framework de générer correctement les URLs absolues
    (ex: pour les avatars et images) avec le vrai domaine plutôt que 127.0.0.1:8001.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if 'HTTP_X_FORWARDED_FOR' in request.META or 'HTTP_X_REAL_IP' in request.META:
            # On récupère le domaine de production
            backend_url = os.getenv('BACKEND_URL', 'https://zemy.erika-app.com')
            backend_domain = backend_url.replace('https://', '').replace('http://', '').strip('/')
            
            # Forcer le host et HTTPS pour que request.build_absolute_uri() utilise zemy.erika-app.com
            request.META['HTTP_HOST'] = backend_domain
            request.META['wsgi.url_scheme'] = 'https'
            request.META['SERVER_PORT'] = '443'
            
        return self.get_response(request)
