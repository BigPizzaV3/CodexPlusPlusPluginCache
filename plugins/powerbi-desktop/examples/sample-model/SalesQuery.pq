let
    Source = Csv.Document(File.Contents("sales.csv"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    PromotedHeaders = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    ChangedTypes = Table.TransformColumnTypes(PromotedHeaders, {{"OrderDate", type date}, {"Sales Amount", type number}})
in
    ChangedTypes
