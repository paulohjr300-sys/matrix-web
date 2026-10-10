// Cadastros base com que toda loja nova começa. A loja edita depois em
// Configurações.
export const DEFAULT_CATALOG: Record<string, string[]> = {
    fuels: ['Flex', 'Gasolina', 'Etanol', 'Diesel', 'Elétrico', 'Híbrido', 'GNV'],
    transmissions: ['Manual', 'Automático', 'CVT', 'Automatizado'],
    engines: ['1.0', '1.0 Turbo', '1.3', '1.4', '1.5', '1.6', '1.8', '2.0', '2.0 Turbo', '2.8', '3.0'],
    colors: ['Branco', 'Preto', 'Prata', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Marrom', 'Bege', 'Amarelo'],
    vehicle_categories: ['Hatch', 'Sedan', 'SUV', 'Picape', 'Minivan', 'Utilitário', 'Esportivo', 'Moto'],
    payment_methods: ['Pix', 'Dinheiro', 'Financiamento', 'Cartão de crédito', 'Cartão de débito', 'Troca', 'Consórcio'],
    cost_categories: ['Manutenção', 'Documentação', 'Lavagem e estética', 'Funilaria e pintura', 'Pneus', 'Comissão', 'Transporte', 'Outros'],
    brands: [
        'Audi', 'BMW', 'BYD', 'Chevrolet', 'Citroën', 'Fiat', 'Ford', 'Honda',
        'Hyundai', 'Jeep', 'Kia', 'Mercedes-Benz', 'Mitsubishi', 'Nissan',
        'Peugeot', 'Renault', 'Toyota', 'Volkswagen', 'Volvo',
    ],
}
