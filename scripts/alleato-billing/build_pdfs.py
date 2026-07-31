#!/usr/bin/env python3
"""
Alleato Group billing forms as fillable AcroForm PDFs.

  Form APP — Application and Certificate for Payment   (landscape)
  Form CS  — Continuation Sheet                        (landscape)
  Form CO  — Change Order                              (portrait)

Built to the standard construction-industry payment-application structure: nine
summary lines, the 5a / 5b retainage split, and a continuation sheet with columns
A through I including the unlettered % (G/C) column inside G's span and the WORK
COMPLETED band over columns D and E. Certification language is Alleato's own.
"""

import sys
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

# ---- Alleato Group brand palette -------------------------------------------
ORANGE = HexColor('#FD5602')      # Primary Orange — accents, rules, key highlights
ORANGE2 = HexColor('#DB802E')     # Secondary Orange — tagline
BLACK = HexColor('#000000')       # Primary text / headers
DKGREY = HexColor('#454545')      # Logo text, banner, body alternative
LTGREY = HexColor('#9C9998')      # Subtle accents
WHITE = HexColor('#FFFFFF')

INK = BLACK
GREY = DKGREY
RULE = BLACK
HAIR = LTGREY
FIELD_BG = HexColor('#FFFFFF')
FIELD_BD = HexColor('#B8B5B4')
BOX_FILL = HexColor('#FDEFE7')    # 8% Primary Orange — total rows

BRAND = dict(
    tagline='Your partner from the ground up.',
    web='www.alleatogroup.com',
    hq='8383 Craig Street, Suite 150, Indianapolis, IN 46250',
    fl='701 94th Avenue North, Suite 118, St. Petersburg, FL 33702',
)

# ---- type: Lato is an Alleato brand font; Lato Black stands in for Work Sans
import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

LATO_DIR = '/usr/share/fonts/truetype/lato'
FONTS = {
    'Body': 'Lato-Light.ttf', 'BodyIt': 'Lato-LightItalic.ttf',
    'Text': 'Lato-Regular.ttf', 'TextIt': 'Lato-Italic.ttf',
    'Bold': 'Lato-Bold.ttf', 'BoldIt': 'Lato-BoldItalic.ttf',
    'Head': 'Lato-Black.ttf', 'HeadIt': 'Lato-BlackItalic.ttf',
}
HAVE_LATO = os.path.isdir(LATO_DIR) and all(
    os.path.isfile(os.path.join(LATO_DIR, f)) for f in FONTS.values())
if HAVE_LATO:
    for name, fn in FONTS.items():
        pdfmetrics.registerFont(TTFont('Alleato-' + name, os.path.join(LATO_DIR, fn)))
    F_BODY_N, F_BODY_I = 'Alleato-Body', 'Alleato-BodyIt'
    F_TEXT_N, F_TEXT_I = 'Alleato-Text', 'Alleato-TextIt'
    F_BOLD_N, F_BOLD_I = 'Alleato-Bold', 'Alleato-BoldIt'
    F_HEAD_N, F_HEAD_I = 'Alleato-Head', 'Alleato-HeadIt'
else:                                     # graceful fallback
    F_BODY_N = F_TEXT_N = 'Helvetica'
    F_BODY_I = F_TEXT_I = 'Helvetica-Oblique'
    F_BOLD_N = F_HEAD_N = 'Helvetica-Bold'
    F_BOLD_I = F_HEAD_I = 'Helvetica-BoldOblique'

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_REVERSED = os.path.join(HERE, 'brand', 'Alleato-Logo-Reversed.png')
LOGO_DARK = os.path.join(HERE, 'brand', 'Alleato-Logo-Dark.png')

_LOGO_FOR_ASPECT = LOGO_REVERSED


def _logo_aspect(path=None):
    """Width / height of the logo asset, read from the file so resizing it is safe."""
    try:
        from PIL import Image
        with Image.open(path or _LOGO_FOR_ASPECT) as im:
            return im.width / im.height
    except Exception:
        return 1956 / 593.0

M = 0.45 * inch
LAND = landscape(letter)


def words(variant):
    if variant == 'owner':
        return dict(
            payee='CONTRACTOR', payer='OWNER',
            to_label='TO OWNER:', from_label='FROM CONTRACTOR:', via_label='VIA ARCHITECT:',
            third='ARCHITECT', third_proj="ARCHITECT'S PROJECT NO:",
            app_head='CONTRACTOR’S APPLICATION FOR PAYMENT',
            cert_head='CONTRACTOR’S CERTIFICATION',
            arch_head='ARCHITECT’S CERTIFICATE FOR PAYMENT',
            certifier='ARCHITECT',
            co_parties=['OWNER', 'ARCHITECT', 'CONTRACTOR'],
            tag='OWNER',
        )
    return dict(
        payee='SUBCONTRACTOR', payer='CONTRACTOR',
        to_label='TO CONTRACTOR:', from_label='FROM SUBCONTRACTOR:', via_label='VIA PROJECT MANAGER:',
        third='PROJECT MANAGER', third_proj='PROJECT NO:',
        app_head='SUBCONTRACTOR’S APPLICATION FOR PAYMENT',
        cert_head='SUBCONTRACTOR’S CERTIFICATION',
        arch_head='CONTRACTOR’S APPROVAL FOR PAYMENT',
        certifier='CONTRACTOR',
        co_parties=['CONTRACTOR', 'SUBCONTRACTOR'],
        tag='SUBCONTRACTOR',
    )


class Form:
    def __init__(self, path, title, pagesize=LAND):
        self.c = canvas.Canvas(path, pagesize=pagesize)
        self.W, self.H = pagesize
        self.c.setTitle(title)

    # ---- text ---------------------------------------------------------
    @staticmethod
    def font(bold=False, italic=False, head=False, body=False):
        if head:
            return F_HEAD_I if italic else F_HEAD_N
        if bold:
            return F_BOLD_I if italic else F_BOLD_N
        if body:
            return F_BODY_I if italic else F_BODY_N
        return F_TEXT_I if italic else F_TEXT_N

    def t(self, x, y, s, size=7.5, bold=False, italic=False, color=INK, align='l', head=False):
        f = self.font(bold, italic, head)
        self.c.setFont(f, size)
        self.c.setFillColor(color)
        if align == 'r':
            self.c.drawRightString(x, y, s)
        elif align == 'c':
            self.c.drawCentredString(x, y, s)
        else:
            self.c.drawString(x, y, s)

    def tfit(self, x, y, s, maxw, size=7.5, bold=False, italic=False, color=INK, align='l',
             head=False):
        f = self.font(bold, italic, head)
        while size > 4.2 and self.c.stringWidth(s, f, size) > maxw:
            size -= 0.2
        self.t(x, y, s, size, bold, italic, color, align, head)

    def para(self, x, y, w, s, size=7.4, lead=9.2, color=INK, italic=False, justify=True):
        f = self.font(italic=italic, body=True)
        lines = simpleSplit(s, f, size, w)
        self.c.setFont(f, size)
        self.c.setFillColor(color)
        for i, ln in enumerate(lines):
            yy = y - i * lead
            if justify and i < len(lines) - 1 and len(ln.split()) > 1:
                self._justify(x, yy, ln, w, f, size)
            else:
                self.c.drawString(x, yy, ln)
        return y - (len(lines) - 1) * lead

    def _justify(self, x, y, line, w, font, size):
        wds = line.split()
        text_w = sum(self.c.stringWidth(t, font, size) for t in wds)
        gap = (w - text_w) / (len(wds) - 1)
        cx = x
        for t in wds:
            self.c.drawString(cx, y, t)
            cx += self.c.stringWidth(t, font, size) + gap

    def leader(self, x, y, s, xend, size=7.4, bold=True):
        """Label followed by dot leaders out to xend."""
        f = self.font(bold=bold)
        self.c.setFont(f, size)
        self.c.setFillColor(INK)
        self.c.drawString(x, y, s)
        w = self.c.stringWidth(s, f, size)
        dx = x + w + 3
        dotf = self.font()
        self.c.setFont(dotf, size)
        self.c.setFillColor(LTGREY)
        dots = ''
        while self.c.stringWidth(dots + '.', dotf, size) < (xend - dx):
            dots += '.'
        self.c.drawString(dx, y, dots)
        self.c.setFillColor(INK)

    def dots(self, x, y, xend, size=7.4):
        fn = self.font()
        self.c.setFont(fn, size)
        self.c.setFillColor(LTGREY)
        d = ''
        while self.c.stringWidth(d + '.', fn, size) < (xend - x):
            d += '.'
        self.c.drawString(x, y, d)
        self.c.setFillColor(INK)

    # ---- rules / boxes ----------------------------------------------
    def rule(self, x1, y, x2, w=1.0, color=RULE):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(w)
        self.c.line(x1, y, x2, y)

    def vrule(self, x, y1, y2, w=0.6, color=HAIR):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(w)
        self.c.line(x, y1, x, y2)

    def box(self, x, y, w, h, lw=0.6, color=HAIR, fill=None):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(lw)
        if fill is not None:
            self.c.setFillColor(fill)
            self.c.rect(x, y, w, h, stroke=1, fill=1)
        else:
            self.c.rect(x, y, w, h, stroke=1, fill=0)

    # ---- fields ------------------------------------------------------
    def fld(self, name, x, y, w, h=12, size=7.5, style='underlined', ml=False, tip=None, bold=False):
        self.c.acroForm.textfield(
            name=name, tooltip=tip or name.replace('_', ' '), x=x, y=y, width=w, height=h,
            fontSize=size, fontName=('Helvetica-Bold' if bold else 'Helvetica'), textColor=black,
            fillColor=FIELD_BG, borderColor=FIELD_BD, borderWidth=0.5,
            borderStyle=style, forceBorder=True,
            fieldFlags='multiline' if ml else '', relative=False)

    def money(self, name, x, y, w, h=12.5, size=7.8, bold=False):
        self.fld(name, x, y, w, h, size, style='inset', bold=bold)

    def check(self, name, x, y, size=9):
        self.c.acroForm.checkbox(
            name=name, tooltip=name.replace('_', ' '), x=x, y=y, size=size,
            borderColor=FIELD_BD, fillColor=FIELD_BG, borderWidth=0.6,
            checked=False, relative=False)

    def save(self):
        self.c.showPage()
        self.c.save()


def title_block(f, doc, subtitle, v, note=None):
    """Alleato letterhead masthead: dark banner + reversed logo, addresses, web."""
    import os
    x0, xr = M, f.W - M
    BH = 38                                        # banner height
    by = f.H - M - BH
    f.c.setFillColor(DKGREY)
    f.c.rect(x0, by, xr - x0, BH, stroke=0, fill=1)

    # reversed logo, left, with clear space
    if os.path.isfile(LOGO_REVERSED):
        lh = 21.0
        lw = lh * _logo_aspect()
        f.c.drawImage(LOGO_REVERSED, x0 + 10, by + (BH - lh) / 2, width=lw, height=lh,
                      mask='auto')
        after = x0 + 10 + lw + 16
    else:
        f.t(x0 + 10, by + BH / 2 + 4, 'ALLEATO GROUP', 13, head=True, color=WHITE)
        f.t(x0 + 10, by + BH / 2 - 9, BRAND['tagline'], 8, italic=True, color=ORANGE2)
        after = x0 + 150

    # contact block, right
    f.t(xr - 10, by + BH - 11, BRAND['hq'], 6.3, color=WHITE, align='r')
    f.t(xr - 10, by + BH - 19, BRAND['fl'], 6.3, color=WHITE, align='r')
    f.t(xr - 10, by + 7, BRAND['web'], 7.2, bold=True, color=ORANGE, align='r')

    # form identity, centred in the banner beside the logo
    f.t(after, by + BH / 2 - 1, f'FORM {doc}', 12, head=True, color=WHITE)
    f.t(after + f.c.stringWidth(f'FORM {doc}', F_HEAD_N, 12) + 10, by + BH / 2 - 1,
        f'· {v["tag"]} BILLING', 9, bold=True, color=LTGREY)

    y = by - 4
    f.c.setFillColor(ORANGE)                       # orange accent rule under the banner
    f.c.rect(x0, y, xr - x0, 2.2, stroke=0, fill=1)

    y -= 15
    f.t(x0, y, subtitle.upper(), 12.5, head=True, color=BLACK)
    if note:
        f.t(xr, y - 9, note, 6.8, color=LTGREY, align='r')
    y -= 6
    f.rule(x0, y, xr, 1.0, DKGREY)
    return y - 4


def footer(f, doc):
    x0, xr = M, f.W - M
    f.c.setFillColor(ORANGE)                       # orange accent bar at the page foot
    f.c.rect(x0, 7, xr - x0, 3.0, stroke=0, fill=1)
    f.t(x0, 15, BRAND['tagline'], 6.8, italic=True, color=ORANGE2)
    f.t(xr, 15, BRAND['web'], 6.8, bold=True, color=DKGREY, align='r')
    f.rule(x0, 38, xr, 0.6, LTGREY)
    f.para(x0, 31, xr - x0,
           f'ALLEATO GROUP Form {doc}. Standard construction-industry payment-application structure; '
           f'certification language is Alleato Group\u2019s own. Where a contract specifies submission '
           f'on a particular third-party form, obtain that form from its publisher and key the figures '
           f'across from this one.',
           size=5.6, lead=6.6, color=LTGREY, justify=False)


# ====================================== Form APP — Application for Payment
def build_app(path, v):
    f = Form(path, 'Application and Certificate for Payment')
    x0, xr = M, f.W - M
    y = title_block(f, 'APP', 'Application and Certificate for Payment', v)

    # ---------------- header field block: 3 columns + distribution
    c1, c2, c3, c4 = x0, x0 + 250, x0 + 470, x0 + 640
    top = y - 12
    # col 1
    f.t(c1, top, v['to_label'], 7.2, bold=True)
    f.fld('payer_name', c1, top - 15, 232, 12)
    f.fld('payer_addr1', c1, top - 29, 232, 12)
    f.t(c1, top - 46, v['from_label'], 7.2, bold=True)
    f.fld('payee_name', c1, top - 61, 232, 12)
    f.fld('payee_addr1', c1, top - 75, 232, 12)
    # col 2
    f.t(c2, top, 'PROJECT:', 7.2, bold=True)
    f.fld('project_name', c2, top - 15, 202, 12)
    f.fld('project_addr', c2, top - 29, 202, 12)
    f.t(c2, top - 46, v['via_label'], 7.2, bold=True)
    f.fld('third_name', c2, top - 61, 202, 12)
    f.fld('third_addr', c2, top - 75, 202, 12)
    # col 3 — label left, field right
    rows3 = [('APPLICATION NO:', 'application_no'),
             ('PERIOD TO:', 'period_to'),
             ('CONTRACT FOR:', 'contract_for'),
             ('CONTRACT DATE:', 'contract_date')]
    yy = top
    for lbl, nm in rows3:
        f.t(c3, yy, lbl, 7.2, bold=True)
        f.fld(nm, c3 + 82, yy - 3, 76, 12)
        yy -= 18
    f.t(c3, yy, 'PROJECT NOS:', 7.2, bold=True)
    f.fld('project_no_1', c3 + 82, yy - 3, 30, 12)
    f.t(c3 + 114, yy, '/', 8, bold=True)
    f.fld('project_no_2', c3 + 120, yy - 3, 30, 12)
    f.t(c3 + 152, yy, '/', 8, bold=True)
    f.fld('project_no_3', c3 + 158, yy - 3, 30, 12)
    # col 4 — distribution checkboxes
    f.t(xr, top, 'Distribution to:', 7.2, bold=True, align='r')
    for i, who in enumerate(['OWNER', v['third'], v['payee'], 'FIELD', 'OTHER']):
        yy2 = top - 15 - i * 15
        f.t(xr - 16, yy2, who, 7.2, align='r')
        f.check('dist_' + who.lower().replace(' ', '_'), xr - 12, yy2 - 2, 9)

    y = top - 92
    f.rule(x0, y, xr, 1.4)

    # ---------------- left column: application for payment
    LW = 430                      # left column width
    lx, lxe = x0, x0 + LW
    ly = y - 14
    f.t(lx, ly, v['app_head'], 10.5, head=True, color=BLACK)
    f.c.setFillColor(ORANGE)
    f.c.rect(lx, ly - 6, 46, 2, stroke=0, fill=1)
    ly -= 17
    ly = f.para(lx, ly, LW - 10,
                'Application is made for payment, as shown below, in connection with the Contract. '
                'The Continuation Sheet, showing the schedule of values, is attached.',
                size=7.2, lead=9, justify=False) - 13

    AMT_W = 108
    amt_x = lxe - AMT_W
    dollar_x = amt_x - 8

    LINES = [
        ('1. ORIGINAL CONTRACT SUM', None, 'l1_original_contract_sum'),
        ('2. NET CHANGE BY CHANGE ORDERS', None, 'l2_net_change_by_change_orders'),
        ('3. CONTRACT SUM TO DATE', '(Line 1 ± 2)', 'l3_contract_sum_to_date'),
        ('4. TOTAL COMPLETED & STORED TO DATE', '(Column G, Continuation Sheet)',
         'l4_total_completed_and_stored_to_date'),
    ]
    for lbl, ital, nm in LINES:
        f.t(lx, ly, lbl, 7.4, bold=True)
        endx = lx + f.c.stringWidth(lbl, f.font(bold=True), 7.4)
        if ital:
            f.t(endx + 5, ly, ital, 6.9, italic=True, color=DKGREY)
            endx += 5 + f.c.stringWidth(ital, f.font(italic=True), 6.9)
        f.dots(endx + 5, ly, dollar_x - 4, 7.4)
        f.t(dollar_x, ly, '$', 8, bold=True)
        f.money(nm, amt_x, ly - 3, AMT_W)
        ly -= 15

    # Line 5 retainage block
    f.t(lx, ly, '5. RETAINAGE:', 7.4, bold=True)
    ly -= 15
    f.t(lx + 14, ly, 'a.', 7.4, bold=True)
    f.fld('l5a_retainage_pct_work', lx + 28, ly - 3, 32, 12, 7.5)
    f.t(lx + 64, ly, '% of Completed Work', 7.3)
    ly -= 12
    f.t(lx + 28, ly, '(Columns D + E, Continuation Sheet)', 6.9, italic=True)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l5a_retainage_work', amt_x, ly - 3, AMT_W)
    ly -= 15.5
    f.t(lx + 14, ly, 'b.', 7.4, bold=True)
    f.fld('l5b_retainage_pct_materials', lx + 28, ly - 3, 32, 12, 7.5)
    f.t(lx + 64, ly, '% of Stored Material', 7.3)
    ly -= 12
    f.t(lx + 28, ly, '(Column F, Continuation Sheet)', 6.9, italic=True)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l5b_retainage_materials', amt_x, ly - 3, AMT_W)
    ly -= 17
    f.t(lx + 28, ly, 'Total Retainage', 7.4)
    f.t(lx + 88, ly, '(Lines 5a + 5b, or Total in Column I)', 6.9, italic=True)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l5_total_retainage', amt_x, ly - 3, AMT_W)
    ly -= 17

    f.leader(lx, ly, '6. TOTAL EARNED LESS RETAINAGE', dollar_x - 4)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l6_total_earned_less_retainage', amt_x, ly - 3, AMT_W)
    ly -= 11
    f.t(lx + 14, ly, '(Line 4 minus Line 5 Total)', 6.9, italic=True)
    ly -= 14
    f.leader(lx, ly, '7. LESS PREVIOUS CERTIFICATES FOR PAYMENT', dollar_x - 4)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l7_less_previous_certificates', amt_x, ly - 3, AMT_W)
    ly -= 11
    f.t(lx + 14, ly, '(Line 6 from prior Certificate)', 6.9, italic=True)
    ly -= 16
    f.leader(lx, ly, '8. CURRENT PAYMENT DUE', dollar_x - 4)
    f.box(dollar_x - 4, ly - 4.5, AMT_W + 16, 16, lw=1.1, color=RULE)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l8_current_payment_due', amt_x, ly - 3, AMT_W, h=13, size=8.4, bold=True)
    ly -= 18
    f.t(lx, ly, '9. BALANCE TO FINISH, INCLUDING RETAINAGE', 7.4, bold=True)
    ly -= 11
    f.t(lx + 14, ly, '(Line 3 minus Line 6)', 6.9, italic=True)
    f.t(dollar_x, ly, '$', 8, bold=True)
    f.money('l9_balance_to_finish', amt_x, ly - 3, AMT_W)
    ly -= 14

    # ---------------- change order summary table
    tw = LW
    cw = [258, 106, 106]
    scale = tw / sum(cw)
    cw = [c * scale for c in cw]
    rows = [('CHANGE ORDER SUMMARY', 'ADDITIONS', 'DEDUCTIONS', None, None, True),
            ('Total changes approved in previous months by ' + v['payer'].title(),
             '$', '$', 'co_prev_additions', 'co_prev_deductions', False),
            ('Total approved this month', '$', '$', 'co_this_additions', 'co_this_deductions', False),
            ('TOTAL', '$', '$', 'co_total_additions', 'co_total_deductions', False),
            ('NET CHANGES by Change Order', '$', None, 'co_net_change', None, False)]
    rh = 13.5
    ty = ly
    for i, (lbl, a, d, an, dn, head) in enumerate(rows):
        cx = lx
        for j, w in enumerate(cw):
            if j == 1 and d is None:
                f.box(cx, ty - rh, cw[1] + cw[2], rh, lw=0.7, color=RULE,
                      fill=BOX_FILL if head else None)
                break
            f.box(cx, ty - rh, w, rh, lw=0.7, color=RULE, fill=DKGREY if head else None)
            cx += w
        if head:
            f.tfit(lx + 4, ty - rh + 4.5, lbl, cw[0] - 8, 8, head=True, color=WHITE)
            f.t(lx + cw[0] + cw[1] / 2, ty - rh + 4.5, a, 7.6, bold=True, color=WHITE, align='c')
            f.t(lx + cw[0] + cw[1] + cw[2] / 2, ty - rh + 4.5, d, 7.6, bold=True, color=WHITE,
                align='c')
        else:
            align = 'r' if lbl == 'TOTAL' else 'l'
            if align == 'r':
                f.t(lx + cw[0] - 5, ty - rh + 4.5, lbl, 7.4, bold=True, align='r')
            else:
                f.tfit(lx + 4, ty - rh + 4.5, lbl, cw[0] - 8, 7.4)
            f.t(lx + cw[0] + 4, ty - rh + 4.5, '$', 7.6, bold=True)
            f.money(an, lx + cw[0] + 12, ty - rh + 1.5, cw[1] - 16, h=12)
            if dn:
                f.t(lx + cw[0] + cw[1] + 4, ty - rh + 4.5, '$', 7.6, bold=True)
                f.money(dn, lx + cw[0] + cw[1] + 12, ty - rh + 1.5, cw[2] - 16, h=12)
        ty -= rh

    # ---------------- right column
    rx = x0 + LW + 18
    body_top = y - 2
    ry = y - 14
    cert = (f'The undersigned {v["payee"].title()} certifies that to the best of the '
            f'{v["payee"].title()}’s knowledge, information and belief the Work covered by this '
            f'Application for Payment has been completed in accordance with the Contract Documents, '
            f'that all amounts have been paid by the {v["payee"].title()} for Work for which previous '
            f'Certificates for Payment were issued and payments received from the '
            f'{v["payer"].title()}, and that current payment shown herein is now due.')
    ry = f.para(rx, ry, xr - rx, cert, size=7.3, lead=9) - 15

    f.t(rx, ry, v['payee'] + ':', 7.4, bold=True)
    ry -= 15
    f.t(rx, ry, 'By:', 7.5)
    f.fld('payee_signature', rx + 20, ry - 3, 128, 13)
    f.t(rx + 154, ry, 'Date:', 7.5)
    f.fld('payee_date', rx + 182, ry - 3, xr - (rx + 182), 13)
    ry -= 17
    f.t(rx, ry, 'State of:', 7.5)
    f.fld('notary_state', rx + 44, ry - 3, 150, 12)
    ry -= 15
    f.t(rx, ry, 'County of:', 7.5)
    f.fld('notary_county', rx + 50, ry - 3, 144, 12)
    ry -= 15
    f.t(rx, ry, 'Subscribed and sworn to before', 7.5)
    ry -= 14
    f.t(rx, ry, 'me this', 7.5)
    f.fld('notary_day', rx + 34, ry - 3, 46, 12)
    f.t(rx + 86, ry, 'day of', 7.5)
    f.fld('notary_month_year', rx + 116, ry - 3, xr - (rx + 116), 12)
    ry -= 17
    f.t(rx, ry, 'Notary Public:', 7.5)
    f.fld('notary_public', rx + 68, ry - 3, xr - (rx + 68), 12)
    ry -= 15
    f.t(rx, ry, 'My commission expires:', 7.5)
    f.fld('notary_expires', rx + 112, ry - 3, xr - (rx + 112), 12)
    ry -= 13

    f.rule(rx - 10, ry, xr, 1.2)
    ry -= 14
    f.tfit(rx, ry, v['arch_head'], xr - rx, 10.5, head=True, color=BLACK)
    f.c.setFillColor(ORANGE)
    f.c.rect(rx, ry - 6, 46, 2, stroke=0, fill=1)
    ry -= 16
    cert2 = (f'In accordance with the Contract Documents, based on on-site observations and the data '
             f'comprising this application, the {v["certifier"].title()} certifies to the '
             f'{v["payer"].title()} that to the best of the {v["certifier"].title()}’s knowledge, '
             f'information and belief the Work has progressed as indicated, the quality of the Work is '
             f'in accordance with the Contract Documents, and the {v["payee"].title()} is entitled to '
             f'payment of the AMOUNT CERTIFIED.')
    ry = f.para(rx, ry, xr - rx, cert2, size=7.3, lead=9) - 16

    f.leader(rx, ry, 'AMOUNT CERTIFIED', xr - 122, size=7.6)
    f.t(xr - 118, ry, '$', 8, bold=True)
    f.money('amount_certified', xr - 108, ry - 3, 108, h=13, size=8.4, bold=True)
    ry -= 12
    ry = f.para(rx, ry, xr - rx,
                '(Attach explanation if amount certified differs from the amount applied. Initial all '
                'figures on this Application and on the Continuation Sheet that are changed to conform '
                'with the amount certified.)',
                size=6.9, lead=8.2, italic=True, justify=False) - 14

    f.t(rx, ry, v['certifier'] + ':', 7.4, bold=True)
    ry -= 15
    f.t(rx, ry, 'By:', 7.5)
    f.fld('certifier_signature', rx + 20, ry - 3, 128, 13)
    f.t(rx + 154, ry, 'Date:', 7.5)
    f.fld('certifier_date', rx + 182, ry - 3, xr - (rx + 182), 13)
    ry -= 16
    f.para(rx, ry, xr - rx,
           f'This Certificate is not negotiable. The AMOUNT CERTIFIED is payable only to the '
           f'{v["payee"].title()} named herein. Issuance, payment and acceptance of payment are '
           f'without prejudice to any rights of the {v["payer"].title()} or {v["payee"].title()} '
           f'under this Contract.',
           size=6.9, lead=8.4)

    f.vrule(x0 + LW + 8, min(ty, ry) - 6, body_top, 0.8, HAIR)
    footer(f, 'APP')
    f.save()


# ================================================ Form CS — Continuation Sheet
CS_COLS = [
    # (letter, heading lines, italic tail, width units, field base)
    ('A', ['ITEM', 'NO.'],                              None,             42, 'item_no'),
    ('B', ['DESCRIPTION OF WORK'],                      None,            238, 'description'),
    ('C', ['SCHEDULED', 'VALUE'],                       None,             98, 'scheduled_value'),
    ('D', ['FROM PREVIOUS', 'APPLICATION'],             '(D + E)',        98, 'work_previous'),
    ('E', ['THIS PERIOD'],                              None,             92, 'work_this_period'),
    ('F', ['MATERIALS', 'PRESENTLY', 'STORED'],         '(Not in D or E)', 98, 'materials_stored'),
    ('G', ['TOTAL', 'COMPLETED AND', 'STORED TO DATE'], '(D+E+F)',        104, 'total_completed'),
    ('',  ['%'],                                        '(G ÷ C)',         50, 'percent'),
    ('H', ['BALANCE TO', 'FINISH'],                     '(C – G)',         98, 'balance_to_finish'),
    ('I', ['RETAINAGE'],                                '(If variable rate)', 104, 'retainage'),
]
D_IDX, E_IDX = 3, 4      # columns grouped under the WORK COMPLETED band
G_SPAN = (6, 7)          # letter G spans the total column and the % column


def build_cs(path, v, rows=21):
    f = Form(path, 'Continuation Sheet')
    x0, xr = M, f.W - M
    y = title_block(f, 'CS', 'Continuation Sheet', v)

    # ---------------- header: note left, four fields right
    ny = y - 13
    f.para(x0, ny, 440,
           f'The Application and Certificate for Payment containing the {v["payee"].title()}’s signed '
           f'certification is attached. Use Column I on Contracts where variable retainage for line '
           f'items may apply.', size=7.3, lead=9.4, justify=False)
    hx = x0 + 470
    for i, (lbl, nm) in enumerate([('APPLICATION NO:', 'application_no'),
                                   ('APPLICATION DATE:', 'application_date'),
                                   ('PERIOD TO:', 'period_to'),
                                   (v['third_proj'], 'third_project_no')]):
        yy = ny - i * 15
        f.tfit(hx, yy, lbl, 118, 7.3, bold=True)
        f.fld(nm, hx + 122, yy - 3, xr - (hx + 122), 12)

    ty = ny - 66

    # ---------------- column geometry
    units = sum(c[3] for c in CS_COLS)
    scale = (xr - x0) / units
    widths = [c[3] * scale for c in CS_COLS]
    xs, acc = [], x0
    for w in widths:
        xs.append(acc)
        acc += w

    # letter row — G spans the total column and the unlettered % column
    LH = 13
    i = 0
    while i < len(CS_COLS):
        letter = CS_COLS[i][0]
        if i == G_SPAN[0]:
            w = widths[G_SPAN[0]] + widths[G_SPAN[1]]
            f.box(xs[i], ty - LH, w, LH, lw=0.7, color=RULE)
            f.t(xs[i] + w / 2, ty - LH + 4, letter, 7.2, align='c')
            i += 2
            continue
        f.box(xs[i], ty - LH, widths[i], LH, lw=0.7, color=RULE)
        if letter:
            f.t(xs[i] + widths[i] / 2, ty - LH + 4, letter, 7.2, align='c')
        i += 1
    ty -= LH

    # header cells — D and E sit under a merged WORK COMPLETED band
    HH = 54
    BAND = 15
    for i, (letter, heads, tail, u, base) in enumerate(CS_COLS):
        x, w = xs[i], widths[i]
        if i in (D_IDX, E_IDX):
            f.box(x, ty - HH, w, HH - BAND, lw=0.7, color=RULE)
            n = len(heads) + (1 if tail else 0)
            cy = ty - BAND - (HH - BAND) / 2 + (n - 1) * 4.3 - 2.4
            for j, h in enumerate(heads):
                f.tfit(x + w / 2, cy - j * 8.6, h, w - 4, 7.1, align='c')
            if tail:
                f.tfit(x + w / 2, cy - len(heads) * 8.6, tail, w - 4, 6.9, italic=True, align='c')
            continue
        f.box(x, ty - HH, w, HH, lw=0.7, color=RULE)
        n = len(heads) + (1 if tail else 0)
        cy = ty - HH / 2 + (n - 1) * 4.3 - 2.4
        for j, h in enumerate(heads):
            f.tfit(x + w / 2, cy - j * 8.6, h, w - 4, 7.1, align='c')
        if tail:
            f.tfit(x + w / 2, cy - len(heads) * 8.6, tail, w - 4, 6.9, italic=True, align='c')
    # the WORK COMPLETED band across D + E
    bx, bw = xs[D_IDX], widths[D_IDX] + widths[E_IDX]
    f.box(bx, ty - BAND, bw, BAND, lw=0.7, color=RULE)
    f.t(bx + bw / 2, ty - BAND + 4.5, 'WORK COMPLETED', 7.4, align='c')
    ty -= HH

    # ---------------- data rows
    rh = 14
    for r in range(rows):
        for i, (letter, heads, tail, u, base) in enumerate(CS_COLS):
            f.c.acroForm.textfield(
                name=f'{base}_{r + 1}', tooltip=f'Row {r + 1} — {" ".join(heads)}',
                x=xs[i], y=ty - rh, width=widths[i], height=rh,
                fontSize=7.4, fontName='Helvetica', textColor=black,
                fillColor=FIELD_BG, borderColor=FIELD_BD, borderWidth=0.4,
                borderStyle='inset', forceBorder=True, relative=False)
        ty -= rh

    # ---------------- grand total
    GH = 17
    for i, (letter, heads, tail, u, base) in enumerate(CS_COLS):
        if i <= 1:
            f.box(xs[i], ty - GH, widths[i], GH, lw=1.0, color=RULE, fill=BOX_FILL)
        else:
            f.c.acroForm.textfield(
                name=f'{base}_grand_total', tooltip=f'GRAND TOTAL — {" ".join(heads)}',
                x=xs[i], y=ty - GH, width=widths[i], height=GH,
                fontSize=8, fontName='Helvetica-Bold', textColor=black,
                fillColor=BOX_FILL, borderColor=RULE, borderWidth=0.8,
                borderStyle='inset', forceBorder=True, relative=False)
    f.t(xs[1] + widths[1] / 2, ty - GH + 5.5, 'GRAND TOTAL', 8, bold=True, align='c')

    footer(f, 'CS')
    f.save()


# ====================================================== Form CO — Change Order
def build_co(path, v, rows=8):
    f = Form(path, 'Change Order', pagesize=letter)
    x0, xr = M, f.W - M
    y = title_block(f, 'CO', 'Change Order', v)

    colw = (xr - x0 - 18) / 2
    rx = x0 + colw + 18
    left = [('PROJECT:', 'project_name'), ('', 'project_addr'),
            (v['payer'] + ':', 'payer_name'), (v['payee'] + ':', 'payee_name'),
            (v['third'] + ':', 'third_name')]
    right = [('CHANGE ORDER NUMBER:', 'change_order_no'), ('DATE:', 'co_date'),
             ('CONTRACT FOR:', 'contract_for'), ('CONTRACT DATE:', 'contract_date'),
             (v['third_proj'], 'third_project_no')]
    ly = y - 14
    for lbl, nm in left:
        f.tfit(x0, ly, lbl, 96, 7.2, bold=True)
        f.fld(nm, x0 + 100, ly - 3, colw - 100, 12)
        ly -= 16
    ry = y - 14
    for lbl, nm in right:
        f.tfit(rx, ry, lbl, 116, 7.2, bold=True)
        f.fld(nm, rx + 120, ry - 3, xr - (rx + 120), 12)
        ry -= 16
    y = min(ly, ry) - 4
    f.rule(x0, y, xr, 1.2)

    y -= 14
    f.t(x0, y, 'THE CONTRACT IS CHANGED AS FOLLOWS:', 9.5, head=True, color=BLACK)
    f.c.setFillColor(ORANGE)
    f.c.rect(x0, y - 6, 46, 2, stroke=0, fill=1)
    y -= 16
    f.t(x0, y, '(Include, where applicable, any undisputed amount attributable to previously executed '
               'Construction Change Directives.)', 7, italic=True, color=GREY)
    y -= 8
    f.fld('change_description', x0, y - 92, xr - x0, 92, 7.6, style='inset', ml=True)
    y -= 102

    # cost breakdown
    heads = [('DESCRIPTION', 300, 'line_description'), ('COST CODE', 100, 'line_cost_code'),
             ('QTY', 60, 'line_qty'), ('UNIT', 50, 'line_uom'),
             ('UNIT COST', 90, 'line_unit_cost'), ('AMOUNT', 100, 'line_amount')]
    tw = sum(h[1] for h in heads)
    sc = (xr - x0) / tw
    ws_ = [h[1] * sc for h in heads]
    cx = x0
    for (h, _, _), w in zip(heads, ws_):
        f.box(cx, y - 14, w, 14, lw=0.7, color=RULE, fill=BOX_FILL)
        f.t(cx + w / 2, y - 10, h, 7, bold=True, align='c')
        cx += w
    y -= 14
    for r in range(rows):
        cx = x0
        for (h, _, base), w in zip(heads, ws_):
            f.c.acroForm.textfield(
                name=f'{base}_{r + 1}', tooltip=f'Row {r + 1} — {h}', x=cx, y=y - 14, width=w,
                height=14, fontSize=7.4, fontName='Helvetica', textColor=black,
                fillColor=FIELD_BG, borderColor=FIELD_BD, borderWidth=0.4,
                borderStyle='inset', forceBorder=True, relative=False)
            cx += w
        y -= 14
    cx = x0
    for i, ((h, _, base), w) in enumerate(zip(heads, ws_)):
        if i == len(heads) - 1:
            f.c.acroForm.textfield(
                name='co_total', tooltip='Total this Change Order', x=cx, y=y - 16, width=w,
                height=16, fontSize=8.4, fontName='Helvetica-Bold', textColor=black,
                fillColor=BOX_FILL, borderColor=RULE, borderWidth=0.9,
                borderStyle='inset', forceBorder=True, relative=False)
        else:
            f.box(cx, y - 16, w, 16, lw=0.9, color=RULE, fill=BOX_FILL)
        cx += w
    f.t(x0 + 5, y - 11, 'TOTAL THIS CHANGE ORDER', 7.6, bold=True)
    y -= 26

    # contract sum reconciliation — two columns
    AW = 116
    recon = [
        ('The original Contract Sum was', 'original_contract_sum'),
        ('The net change by previously authorized Change Orders', 'net_previous_cos'),
        ('The Contract Sum prior to this Change Order was', 'contract_sum_prior'),
        ('The Contract Sum will be increased / (decreased) by this Change Order in the amount of',
         'this_co_amount'),
        ('The new Contract Sum including this Change Order will be', 'new_contract_sum'),
    ]
    for lbl, nm in recon:
        f.leader(x0, y, lbl, xr - AW - 14, size=7.4, bold=False)
        f.t(xr - AW - 10, y, '$', 8, bold=True)
        f.money(nm, xr - AW, y - 3, AW)
        y -= 16
    f.leader(x0, y, 'The Contract Time will be increased / (decreased) by', xr - AW - 14,
             size=7.4, bold=False)
    f.fld('time_change_days', xr - AW, y - 3, 52, 12)
    f.t(xr - AW + 58, y, 'calendar days.', 7.4)
    y -= 16
    f.leader(x0, y, 'The date of Substantial Completion as of the date of this Change Order therefore is',
             xr - AW - 14, size=7.4, bold=False)
    f.fld('substantial_completion_date', xr - AW, y - 3, AW, 12)
    y -= 18
    f.para(x0, y, xr - x0,
           'NOTE: This Change Order does not include changes in the Contract Sum, Contract Time or '
           'Guaranteed Maximum Price which have been authorized by Construction Change Directive '
           'until the cost and time have been agreed upon by both the ' + v['payer'].title() +
           ' and ' + v['payee'].title() + '.', size=7, lead=8.6, color=GREY, justify=False)
    y -= 24

    f.t(x0, y, 'NOT VALID UNTIL SIGNED BY THE ' +
        ', '.join(v['co_parties'][:-1]) + ' AND ' + v['co_parties'][-1] + '.', 8, bold=True)
    y -= 6
    span = (xr - x0) / len(v['co_parties'])
    for i, role in enumerate(v['co_parties']):
        cx = x0 + i * span
        yy = y
        f.t(cx, yy - 9, role, 7.4, bold=True)
        yy -= 26
        for lbl, base in [('(Firm name)', 'firm'), ('BY  (Signature)', 'signature'),
                          ('(Typed name)', 'typed_name'), ('DATE', 'date')]:
            f.fld(f'{role.lower()}_{base}', cx, yy, span - 16, 13)
            f.t(cx, yy - 7.5, lbl, 6.2, color=GREY)
            yy -= 22

    footer(f, 'CO')
    f.save()


if __name__ == '__main__':
    out = sys.argv[1]
    for variant in ('owner', 'sub'):
        v = words(variant)
        for code, fn in (('APP', build_app), ('CS', build_cs), ('CO', build_co)):
            p = f'{out}/Form-{code}-{v["tag"]}.pdf'
            fn(p, v)
            print('wrote', p)
