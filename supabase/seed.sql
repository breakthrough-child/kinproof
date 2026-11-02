-- Reference data. Institutions use placeholder sandbox business emails; run
-- `pnpm seed:demo` to overwrite them with the DEMO_*_PAYPAL_EMAIL env vars and to
-- create the demo auth users + The Okafors circle.
insert into public.institutions (name, kind, city, country, paypal_email, aliases, verified, notes) values
 ('St. Luke''s Hospital', 'hospital', 'Lagos', 'NG', 'hospital@business.example.com', '{"st lukes","saint lukes","st. luke''s"}', true, 'Demo sandbox business account'),
 ('Kings College', 'school', 'Lagos', 'NG', 'school@business.example.com', '{"kings college lagos"}', true, 'Demo sandbox business account'),
 ('Legal Aid Council', 'legal', 'Lagos', 'NG', 'legal@business.example.com', '{"legal aid"}', true, 'Demo sandbox business account'),
 ('Adaeze Foundation (demo public figure)', 'public_figure', 'Lagos', 'NG', 'figure@business.example.com', '{"adaeze"}', true, 'Example verified public-figure payee')
on conflict do nothing;
