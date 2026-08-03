def calculer_commission_zemy(
    driver_payout: int,
    is_commission_active: bool,
    commission_percentage: float,
    min_commission: int,
    max_commission: int = None
) -> int:
    """
    Calcule la commission de Zemy sur la base du gain du conducteur
    et des paramètres financiers configurés.
    """
    if not is_commission_active:
        return 0
        
    commission = int(driver_payout * (commission_percentage / 100.0))
    if commission < min_commission:
        commission = min_commission
    if max_commission is not None and commission > max_commission:
        commission = max_commission
        
    return commission
