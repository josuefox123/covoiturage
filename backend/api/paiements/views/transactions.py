from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q

from ...models.paiement import Transaction, Payment
from ...serializers import TransactionSerializer, PaymentSerializer, UserPaymentSerializer

class TransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet gérant l'historique financier des utilisateurs (Portefeuille).
    """
    queryset = Transaction.objects.all().order_by('-created_at')
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return self.queryset
        return self.queryset.filter(user=user)

class PaymentViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour la gestion et l'affichage des paiements dans le dashboard d'administration.
    """
    queryset = Payment.objects.all().order_by('-created_at')
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        queryset = self.queryset.select_related('user', 'booking', 'parcel')
        
        status_filter = self.request.query_params.get('status')
        provider_filter = self.request.query_params.get('provider')
        user_phone = self.request.query_params.get('user_phone')
        search = self.request.query_params.get('search')
        
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if provider_filter:
            queryset = queryset.filter(provider=provider_filter)
        if user_phone:
            queryset = queryset.filter(user__phone__icontains=user_phone)
        if search:
            queryset = queryset.filter(
                Q(transaction_id__icontains=search) |
                Q(user__full_name__icontains=search) |
                Q(user__phone__icontains=search)
            )
            
        return queryset

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        import openpyxl
        from django.http import HttpResponse
        
        payments = self.get_queryset()
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Paiements Zemy"
        
        headers = ["ID Transaction", "Date", "Utilisateur", "Téléphone", "Montant (FCFA)", "Service", "Statut", "Fournisseur"]
        ws.append(headers)
        
        for p in payments:
            service = "Trajet" if p.booking else ("Colis" if p.parcel else "Autre")
            ws.append([
                p.transaction_id,
                p.created_at.strftime("%d/%m/%Y %H:%M") if p.created_at else "",
                p.user.full_name if p.user else "",
                p.user.phone if p.user else "",
                p.amount,
                service,
                p.status,
                p.provider
            ])
            
        response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename=paiements_zemy.xlsx'
        wb.save(response)
        return response

    @action(detail=False, methods=['get'], url_path='export-pdf')
    def export_pdf(self, request):
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from django.http import HttpResponse
        
        payments = self.get_queryset()
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename=paiements_zemy.pdf'
        
        doc = SimpleDocTemplate(response, pagesize=letter, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            leading=28,
            textColor=colors.HexColor('#2F80ED'),
            alignment=1,
            spaceAfter=20
        )
        
        elements.append(Paragraph("Rapport des Paiements - ZEMY", title_style))
        elements.append(Spacer(1, 10))
        
        data = [["ID Trans.", "Date", "Utilisateur", "Montant", "Type", "Statut"]]
        for p in payments:
            service = "Trajet" if p.booking else ("Colis" if p.parcel else "Autre")
            name = (p.user.full_name or p.user.phone)[:15] if p.user else ""
            data.append([
                p.transaction_id[:12] + "..." if len(p.transaction_id) > 12 else p.transaction_id,
                p.created_at.strftime("%d/%m/%y") if p.created_at else "",
                name,
                f"{p.amount} XOF",
                service,
                p.status
            ])
            
        t = Table(data, colWidths=[100, 60, 110, 80, 70, 70])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#2F80ED')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 10),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F9FAFB')),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#E5E7EB')),
            ('FONTSIZE', (0,1), (-1,-1), 9),
        ]))
        
        elements.append(t)
        doc.build(elements)
        return response

    @action(detail=False, methods=['get'], url_path='my-history', permission_classes=[permissions.IsAuthenticated])
    def my_history(self, request):
        payments = Payment.objects.filter(
            user=request.user, status='SUCCESS'
        ).select_related('booking__ride', 'parcel').order_by('-created_at')
        serializer = UserPaymentSerializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='receipt', permission_classes=[permissions.IsAuthenticated])
    def receipt(self, request, pk=None):
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from django.http import HttpResponse
        import io

        try:
            payment = Payment.objects.select_related('user', 'booking__ride', 'parcel').get(pk=pk)
        except Payment.DoesNotExist:
            return Response({"error": "Paiement introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if payment.user != request.user and not request.user.is_staff:
            return Response({"error": "Non autorisé."}, status=status.HTTP_403_FORBIDDEN)

        if payment.status != 'SUCCESS':
            return Response({"error": "Ce paiement n'a pas été complété."}, status=status.HTTP_400_BAD_REQUEST)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=A4,
            rightMargin=20*mm, leftMargin=20*mm,
            topMargin=20*mm, bottomMargin=20*mm
        )
        elements = []
        styles = getSampleStyleSheet()

        PRIMARY = colors.HexColor('#16A34A')
        PRIMARY_DARK = colors.HexColor('#15803D')
        LIGHT_BG = colors.HexColor('#F0FDF4')
        MUTED = colors.HexColor('#6B7280')
        DARK = colors.HexColor('#111827')

        header_style = ParagraphStyle('Header', fontSize=32, textColor=PRIMARY, fontName='Helvetica-Bold',
                                       alignment=1, spaceAfter=2)
        sub_style = ParagraphStyle('Sub', fontSize=10, textColor=MUTED, fontName='Helvetica',
                                    alignment=1, spaceAfter=14)
        elements.append(Paragraph("ZEMY", header_style))
        elements.append(Paragraph("Reçu de paiement officiel", sub_style))
        elements.append(HRFlowable(width="100%", thickness=2, color=PRIMARY, spaceAfter=14))

        status_style = ParagraphStyle('Status', fontSize=14, textColor=PRIMARY_DARK,
                                       fontName='Helvetica-Bold', alignment=1, spaceAfter=12,
                                       backColor=LIGHT_BG, borderPadding=(8, 14, 8, 14))
        elements.append(Paragraph("✓ PAIEMENT CONFIRMÉ", status_style))
        elements.append(Spacer(1, 8*mm))

        amount_style = ParagraphStyle('Amount', fontSize=28, textColor=DARK,
                                       fontName='Helvetica-Bold', alignment=1, spaceAfter=2)
        currency_style = ParagraphStyle('Currency', fontSize=12, textColor=MUTED,
                                         fontName='Helvetica', alignment=1, spaceAfter=16)
        elements.append(Paragraph(f"{payment.amount:,} XOF".replace(",", " "), amount_style))
        elements.append(Paragraph("Montant total payé", currency_style))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB'), spaceAfter=12))

        section_style = ParagraphStyle('Section', fontSize=11, textColor=PRIMARY_DARK,
                                        fontName='Helvetica-Bold', spaceAfter=8, spaceBefore=12)
        cell_style = ParagraphStyle('Cell', fontSize=10, textColor=DARK, fontName='Helvetica')
        cell_muted = ParagraphStyle('CellMuted', fontSize=10, textColor=MUTED, fontName='Helvetica')

        elements.append(Paragraph("Détails de la transaction", section_style))

        if payment.booking and payment.booking.ride:
            ride = payment.booking.ride
            service_detail = f"Trajet — {ride.departure_location} → {ride.arrival_location}"
            date_trajet = ride.departure_date.strftime('%d/%m/%Y') if ride.departure_date else "—"
        elif payment.parcel:
            service_detail = f"Colis — {payment.parcel.id}"
            date_trajet = "—"
        else:
            service_detail = "Service Zemy"
            date_trajet = "—"

        details_data = [
            [Paragraph("Référence", cell_muted), Paragraph(payment.transaction_id, cell_style)],
            [Paragraph("Service", cell_muted), Paragraph(service_detail, cell_style)],
            [Paragraph("Date du trajet", cell_muted), Paragraph(date_trajet, cell_style)],
            [Paragraph("Date du paiement", cell_muted), Paragraph(
                payment.created_at.strftime('%d/%m/%Y à %H:%M') if payment.created_at else "—",
                cell_style
            )],
            [Paragraph("Moyen de paiement", cell_muted), Paragraph("Mobile Money (FeexPay)", cell_style)],
            [Paragraph("Statut", cell_muted), Paragraph("✓ Payé", ParagraphStyle(
                'Paid', fontSize=10, textColor=PRIMARY, fontName='Helvetica-Bold'
            ))],
        ]

        details_table = Table(details_data, colWidths=[55*mm, 110*mm])
        details_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F9FAFB')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 10*mm))

        user_obj = payment.user
        if user_obj:
            elements.append(Paragraph("Informations du payeur", section_style))
            user_data = [
                [Paragraph("Nom complet", cell_muted), Paragraph(user_obj.full_name or "—", cell_style)],
                [Paragraph("Téléphone", cell_muted), Paragraph(user_obj.phone or "—", cell_style)],
                [Paragraph("Email", cell_muted), Paragraph(user_obj.email or "—", cell_style)],
            ]
            user_table = Table(user_data, colWidths=[55*mm, 110*mm])
            user_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F9FAFB')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(user_table)

        elements.append(Spacer(1, 12*mm))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB'), spaceAfter=8))
        footer_style = ParagraphStyle('Footer', fontSize=8, textColor=MUTED, fontName='Helvetica', alignment=1)
        elements.append(Paragraph("Ce reçu est un document officiel généré automatiquement par Zemy.", footer_style))
        elements.append(Paragraph("Pour toute réclamation : zemy@sinustic.com | www.zemy.bj", footer_style))
        elements.append(Paragraph(
            f"Généré le {payment.created_at.strftime('%d/%m/%Y à %H:%M') if payment.created_at else ''}",
            footer_style
        ))

        doc.build(elements)
        buffer.seek(0)

        tx_short = payment.transaction_id[:12] if payment.transaction_id else "recu"
        http_response = HttpResponse(buffer.read(), content_type='application/pdf')
        http_response['Content-Disposition'] = f'attachment; filename=recu_zemy_{tx_short}.pdf'
        return http_response
