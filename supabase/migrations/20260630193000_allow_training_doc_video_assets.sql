alter table public.training_doc_assets
  drop constraint if exists training_doc_assets_asset_type_check;

alter table public.training_doc_assets
  add constraint training_doc_assets_asset_type_check
  check (asset_type in ('screenshot', 'image', 'video'));
