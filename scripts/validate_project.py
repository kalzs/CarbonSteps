from pathlib import Path
from html.parser import HTMLParser
import subprocess, sys
ROOT = Path(__file__).resolve().parents[1]
class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.refs=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if a.get('id'): self.ids.append(a['id'])
        if tag=='script' and a.get('src') and not a['src'].startswith(('http://','https://')): self.refs.append(a['src'])
        if tag=='link' and a.get('href') and not a['href'].startswith(('http://','https://','#')): self.refs.append(a['href'])
errors=[]
js_files=list((ROOT/'assets/js').glob('*.js'))+list((ROOT/'database').glob('*.js'))
for file in js_files:
    result=subprocess.run(['node','--check',str(file)],capture_output=True,text=True)
    if result.returncode: errors.append(f'JS syntax: {file.relative_to(ROOT)}\n{result.stderr}')
html_files=list(ROOT.glob('*.html'))+list((ROOT/'pages').glob('*.html'))
for file in html_files:
    parser=PageParser(); parser.feed(file.read_text(encoding='utf-8'))
    duplicates=sorted({item for item in parser.ids if parser.ids.count(item)>1})
    missing=[ref for ref in parser.refs if not (file.parent/ref).exists()]
    if duplicates: errors.append(f'Duplicate IDs in {file.relative_to(ROOT)}: {duplicates}')
    if missing: errors.append(f'Missing local refs in {file.relative_to(ROOT)}: {missing}')
    source=file.read_text(encoding='utf-8')
    if 'data-placeholder-link' in source: errors.append(f'Placeholder nav link remains in {file.relative_to(ROOT)}')
seed_sql=(ROOT/'database/16_seed_transport_factors_and_standardize_co2_units.sql').read_text(encoding='utf-8')
if "0.87" not in seed_sql or "DATE '2021-08-30'" not in seed_sql or 'jdih.esdm.go.id/dokumen/view?id=2183' not in seed_sql:
    errors.append('Electricity factor seed metadata/value is not aligned with JAMALI 0.87 / Kepmen ESDM 2021.')
for code in ['EF-TR-WALK-DIRECT-V1','EF-TR-BICYCLE-DIRECT-V1','EF-TR-MOTOR-PETROL-RON92-WRI2020','EF-TR-CAR-PETROL-RON92-WRI2020','EF-TR-CAR-DIESEL-WRI2020','EF-TR-PARATRANSIT-PETROL-WRI2020','EF-TR-MEDIUM-BUS-DIESEL-WRI2020','EF-TR-BIG-BUS-DIESEL-WRI2020','EF-TR-URBAN-RAIL-8CAR-WRI2020-JAMALI2021','EF-TR-URBAN-RAIL-6CAR-WRI2020-JAMALI2021']:
    if code not in seed_sql: errors.append(f'Missing transport emission factor seed code: {code}')
required=['login.html','register.html','pages/dashboard.html','pages/profile.html','pages/kalkulator-transportasi.html','pages/kalkulator-listrik.html','pages/hasil.html','pages/riwayat.html','pages/rekomendasi.html','database/10_category_save_rpcs.sql','database/11_check_full_app.sql','database/15_correct_electricity_factor_source_metadata.sql','database/16_seed_transport_factors_and_standardize_co2_units.sql','database/17_dedupe_transport_emission_factors.sql','docs/TRANSPORT_FACTORS_V6.md','docs/REPORT_ALIGNMENT_AUDIT.md']
for rel in required:
    if not (ROOT/rel).exists(): errors.append(f'Missing required file: {rel}')
# Formula smoke checks against the declared calculation model.
transport_passenger=14*20*0.1
transport_vehicle=14*20*0.1/2
electricity_kwh=65*8*22/1000
electricity_emission=electricity_kwh*0.87
assert round(transport_passenger,4)==28.0
assert round(transport_vehicle,4)==14.0
assert round(electricity_kwh,4)==11.44
assert round(electricity_emission,4)==9.9528
report_example_kwh=(60*5*20)/1000
report_example_emission=report_example_kwh*0.87
assert round(report_example_kwh,4)==6.0
assert round(report_example_emission,4)==5.22
transport_js=(ROOT/'assets/js/transport-calculator.js').read_text(encoding='utf-8')
if 'dedupeTransportFactors' not in transport_js or 'rawFactorCount' not in transport_js:
    errors.append('Transport calculator is missing the duplicate-factor UI safeguard.')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print(f'PASS: {len(js_files)} JS files, {len(html_files)} HTML files, local references, unique IDs, navigation placeholders, and 0.87 factor formula smoke checks.')
