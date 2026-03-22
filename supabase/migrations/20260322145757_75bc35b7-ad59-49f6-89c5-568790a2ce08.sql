CREATE POLICY stor_bill_del ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'billing-attachments' AND user_has_grant('create_billing_approval'));