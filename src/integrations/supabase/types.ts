export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abastecimentos: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_hora: string
          empresa_id: string
          foto_url: string | null
          ia_litros_extraido: number | null
          ia_processada: boolean
          ia_resposta: Json | null
          ia_valor_extraido: number | null
          id: string
          km_atual: number
          litros: number | null
          motorista_id: string
          observacoes: string | null
          sincronizado_em: string
          valor_total: number | null
          veiculo_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_hora?: string
          empresa_id: string
          foto_url?: string | null
          ia_litros_extraido?: number | null
          ia_processada?: boolean
          ia_resposta?: Json | null
          ia_valor_extraido?: number | null
          id: string
          km_atual: number
          litros?: number | null
          motorista_id: string
          observacoes?: string | null
          sincronizado_em?: string
          valor_total?: number | null
          veiculo_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_hora?: string
          empresa_id?: string
          foto_url?: string | null
          ia_litros_extraido?: number | null
          ia_processada?: boolean
          ia_resposta?: Json | null
          ia_valor_extraido?: number | null
          id?: string
          km_atual?: number
          litros?: number | null
          motorista_id?: string
          observacoes?: string | null
          sincronizado_em?: string
          valor_total?: number | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      afericoes_tanque: {
        Row: {
          criado_em: string
          criado_por: string | null
          data_hora: string
          empresa_id: string
          id: string
          km_odometro: number | null
          litros_aferidos: number
          observacao: string | null
          veiculo_id: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          data_hora?: string
          empresa_id: string
          id: string
          km_odometro?: number | null
          litros_aferidos: number
          observacao?: string | null
          veiculo_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          data_hora?: string
          empresa_id?: string
          id?: string
          km_odometro?: number | null
          litros_aferidos?: number
          observacao?: string | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "afericoes_tanque_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afericoes_tanque_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          alterado_em: string
          alterado_por: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          empresa_id: string
          id: string
          registro_id: string
          tabela: string
        }
        Insert: {
          acao: string
          alterado_em?: string
          alterado_por?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id: string
          id?: string
          registro_id: string
          tabela: string
        }
        Update: {
          acao?: string
          alterado_em?: string
          alterado_por?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          empresa_id?: string
          id?: string
          registro_id?: string
          tabela?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cidade: string | null
          cpf_cnpj: string | null
          criado_em: string
          criado_por: string | null
          email: string | null
          empresa_id: string
          endereco: string | null
          estado: string | null
          id: string
          lat: number | null
          lng: number | null
          nome: string
          nome_fantasia: string | null
          razao_social: string | null
          telefone: string | null
          tipo_pessoa: string
        }
        Insert: {
          cidade?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          empresa_id: string
          endereco?: string | null
          estado?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nome: string
          nome_fantasia?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo_pessoa?: string
        }
        Update: {
          cidade?: string | null
          cpf_cnpj?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          estado?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nome?: string
          nome_fantasia?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo_pessoa?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          atualizado_em: string
          categoria: Database["public"]["Enums"]["despesa_categoria"]
          conferida_em: string | null
          conferida_por: string | null
          criado_em: string
          data: string
          descricao: string | null
          empresa_id: string
          foto_cupom_url: string | null
          id: string
          km_veiculo: number | null
          lancado_por: string
          observacoes: string | null
          status: Database["public"]["Enums"]["despesa_status"]
          valor: number
          veiculo_id: string | null
        }
        Insert: {
          atualizado_em?: string
          categoria?: Database["public"]["Enums"]["despesa_categoria"]
          conferida_em?: string | null
          conferida_por?: string | null
          criado_em?: string
          data?: string
          descricao?: string | null
          empresa_id: string
          foto_cupom_url?: string | null
          id: string
          km_veiculo?: number | null
          lancado_por: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["despesa_status"]
          valor?: number
          veiculo_id?: string | null
        }
        Update: {
          atualizado_em?: string
          categoria?: Database["public"]["Enums"]["despesa_categoria"]
          conferida_em?: string | null
          conferida_por?: string | null
          criado_em?: string
          data?: string
          descricao?: string | null
          empresa_id?: string
          foto_cupom_url?: string | null
          id?: string
          km_veiculo?: number | null
          lancado_por?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["despesa_status"]
          valor?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_venda_seq: {
        Row: {
          empresa_id: string
          last_numero: number
        }
        Insert: {
          empresa_id: string
          last_numero?: number
        }
        Update: {
          empresa_id?: string
          last_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_venda_seq_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativa: boolean
          criada_em: string
          data_inicio: string
          data_vencimento: string
          id: string
          limite_usuarios: number
          nome: string
          plano: string | null
        }
        Insert: {
          ativa?: boolean
          criada_em?: string
          data_inicio?: string
          data_vencimento?: string
          id?: string
          limite_usuarios?: number
          nome: string
          plano?: string | null
        }
        Update: {
          ativa?: boolean
          criada_em?: string
          data_inicio?: string
          data_vencimento?: string
          id?: string
          limite_usuarios?: number
          nome?: string
          plano?: string | null
        }
        Relationships: []
      }
      entregas: {
        Row: {
          assinatura_coletada: boolean
          assinatura_url: string | null
          atualizada_em: string
          cliente_id: string
          comissao_motorista: number | null
          comprovante_assinatura_url: string | null
          comprovante_foto_url: string | null
          criada_em: string
          empresa_id: string
          endereco: string | null
          finalizada_em: string | null
          forma_pagamento: string | null
          foto_material_gps_em: string | null
          foto_material_gps_lat: number | null
          foto_material_gps_lng: number | null
          foto_material_url: string | null
          foto_odometro_final_url: string | null
          gps_fim_em: string | null
          gps_fim_lat: number | null
          gps_fim_lng: number | null
          gps_inicio_em: string | null
          gps_inicio_lat: number | null
          gps_inicio_lng: number | null
          id: string
          iniciada_em: string | null
          jornada_id: string | null
          km_final: number | null
          km_inicial: number | null
          lat: number | null
          lng: number | null
          material_id: string
          motorista_entrega_id: string | null
          motorista_id: string
          motorista_venda_id: string | null
          numero: number | null
          observacoes: string | null
          pagamento_confirmado_em: string | null
          pagamento_confirmado_por: string | null
          preco_base_no_momento: number
          quantidade: number
          sincronizada_em: string
          status: Database["public"]["Enums"]["entrega_status"]
          status_pagamento: string
          valor_frete: number
          valor_praticado: number
          veiculo_id: string | null
        }
        Insert: {
          assinatura_coletada?: boolean
          assinatura_url?: string | null
          atualizada_em?: string
          cliente_id: string
          comissao_motorista?: number | null
          comprovante_assinatura_url?: string | null
          comprovante_foto_url?: string | null
          criada_em?: string
          empresa_id: string
          endereco?: string | null
          finalizada_em?: string | null
          forma_pagamento?: string | null
          foto_material_gps_em?: string | null
          foto_material_gps_lat?: number | null
          foto_material_gps_lng?: number | null
          foto_material_url?: string | null
          foto_odometro_final_url?: string | null
          gps_fim_em?: string | null
          gps_fim_lat?: number | null
          gps_fim_lng?: number | null
          gps_inicio_em?: string | null
          gps_inicio_lat?: number | null
          gps_inicio_lng?: number | null
          id: string
          iniciada_em?: string | null
          jornada_id?: string | null
          km_final?: number | null
          km_inicial?: number | null
          lat?: number | null
          lng?: number | null
          material_id: string
          motorista_entrega_id?: string | null
          motorista_id: string
          motorista_venda_id?: string | null
          numero?: number | null
          observacoes?: string | null
          pagamento_confirmado_em?: string | null
          pagamento_confirmado_por?: string | null
          preco_base_no_momento: number
          quantidade?: number
          sincronizada_em?: string
          status?: Database["public"]["Enums"]["entrega_status"]
          status_pagamento?: string
          valor_frete?: number
          valor_praticado: number
          veiculo_id?: string | null
        }
        Update: {
          assinatura_coletada?: boolean
          assinatura_url?: string | null
          atualizada_em?: string
          cliente_id?: string
          comissao_motorista?: number | null
          comprovante_assinatura_url?: string | null
          comprovante_foto_url?: string | null
          criada_em?: string
          empresa_id?: string
          endereco?: string | null
          finalizada_em?: string | null
          forma_pagamento?: string | null
          foto_material_gps_em?: string | null
          foto_material_gps_lat?: number | null
          foto_material_gps_lng?: number | null
          foto_material_url?: string | null
          foto_odometro_final_url?: string | null
          gps_fim_em?: string | null
          gps_fim_lat?: number | null
          gps_fim_lng?: number | null
          gps_inicio_em?: string | null
          gps_inicio_lat?: number | null
          gps_inicio_lng?: number | null
          id?: string
          iniciada_em?: string | null
          jornada_id?: string | null
          km_final?: number | null
          km_inicial?: number | null
          lat?: number | null
          lng?: number | null
          material_id?: string
          motorista_entrega_id?: string | null
          motorista_id?: string
          motorista_venda_id?: string | null
          numero?: number | null
          observacoes?: string | null
          pagamento_confirmado_em?: string | null
          pagamento_confirmado_por?: string | null
          preco_base_no_momento?: number
          quantidade?: number
          sincronizada_em?: string
          status?: Database["public"]["Enums"]["entrega_status"]
          status_pagamento?: string
          valor_frete?: number
          valor_praticado?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          criada_em: string
          data: string
          empresa_id: string
          encerrada_em: string | null
          foto_odometro_final_url: string | null
          foto_odometro_inicial_url: string | null
          id: string
          km_final: number | null
          km_inicial: number
          motorista_id: string
          veiculo_id: string
        }
        Insert: {
          criada_em?: string
          data?: string
          empresa_id: string
          encerrada_em?: string | null
          foto_odometro_final_url?: string | null
          foto_odometro_inicial_url?: string | null
          id?: string
          km_final?: number | null
          km_inicial: number
          motorista_id: string
          veiculo_id: string
        }
        Update: {
          criada_em?: string
          data?: string
          empresa_id?: string
          encerrada_em?: string | null
          foto_odometro_final_url?: string | null
          foto_odometro_inicial_url?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number
          motorista_id?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais: {
        Row: {
          ativo: boolean
          criado_em: string
          empresa_id: string
          id: string
          nome: string
          preco_base: number
          unidade: Database["public"]["Enums"]["unidade_medida"]
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          empresa_id: string
          id?: string
          nome: string
          preco_base?: number
          unidade?: Database["public"]["Enums"]["unidade_medida"]
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          empresa_id?: string
          id?: string
          nome?: string
          preco_base?: number
          unidade?: Database["public"]["Enums"]["unidade_medida"]
        }
        Relationships: [
          {
            foreignKeyName: "materiais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_motorista: {
        Row: {
          atualizado_em: string
          cpf_cnpj_obrigatorio: boolean | null
          desconto_maximo_percent: number | null
          empresa_id: string
          foto_odometro_obrigatoria: boolean | null
          frete_maximo: number | null
          gps_obrigatorio: boolean | null
          materiais_permitidos: string[] | null
          motorista_id: string
          observacao_obrigatoria: boolean | null
          pode_alterar_frete: boolean | null
          pode_alterar_valor_produto: boolean | null
          pode_cadastrar_cliente: boolean | null
          pode_cancelar_entrega: boolean | null
          telefone_obrigatorio: boolean | null
          valor_venda_maximo: number | null
          valor_venda_minimo: number | null
        }
        Insert: {
          atualizado_em?: string
          cpf_cnpj_obrigatorio?: boolean | null
          desconto_maximo_percent?: number | null
          empresa_id: string
          foto_odometro_obrigatoria?: boolean | null
          frete_maximo?: number | null
          gps_obrigatorio?: boolean | null
          materiais_permitidos?: string[] | null
          motorista_id: string
          observacao_obrigatoria?: boolean | null
          pode_alterar_frete?: boolean | null
          pode_alterar_valor_produto?: boolean | null
          pode_cadastrar_cliente?: boolean | null
          pode_cancelar_entrega?: boolean | null
          telefone_obrigatorio?: boolean | null
          valor_venda_maximo?: number | null
          valor_venda_minimo?: number | null
        }
        Update: {
          atualizado_em?: string
          cpf_cnpj_obrigatorio?: boolean | null
          desconto_maximo_percent?: number | null
          empresa_id?: string
          foto_odometro_obrigatoria?: boolean | null
          frete_maximo?: number | null
          gps_obrigatorio?: boolean | null
          materiais_permitidos?: string[] | null
          motorista_id?: string
          observacao_obrigatoria?: boolean | null
          pode_alterar_frete?: boolean | null
          pode_alterar_valor_produto?: boolean | null
          pode_cadastrar_cliente?: boolean | null
          pode_cancelar_entrega?: boolean | null
          telefone_obrigatorio?: boolean | null
          valor_venda_maximo?: number | null
          valor_venda_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_motorista_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissoes_motorista_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_padrao: {
        Row: {
          atualizado_em: string
          cpf_cnpj_obrigatorio: boolean
          desconto_maximo_percent: number
          empresa_id: string
          foto_odometro_obrigatoria: boolean
          frete_maximo: number | null
          gps_obrigatorio: boolean
          materiais_permitidos: string[] | null
          observacao_obrigatoria: boolean
          pode_alterar_frete: boolean
          pode_alterar_valor_produto: boolean
          pode_cadastrar_cliente: boolean
          pode_cancelar_entrega: boolean
          telefone_obrigatorio: boolean
          valor_venda_maximo: number | null
          valor_venda_minimo: number | null
        }
        Insert: {
          atualizado_em?: string
          cpf_cnpj_obrigatorio?: boolean
          desconto_maximo_percent?: number
          empresa_id: string
          foto_odometro_obrigatoria?: boolean
          frete_maximo?: number | null
          gps_obrigatorio?: boolean
          materiais_permitidos?: string[] | null
          observacao_obrigatoria?: boolean
          pode_alterar_frete?: boolean
          pode_alterar_valor_produto?: boolean
          pode_cadastrar_cliente?: boolean
          pode_cancelar_entrega?: boolean
          telefone_obrigatorio?: boolean
          valor_venda_maximo?: number | null
          valor_venda_minimo?: number | null
        }
        Update: {
          atualizado_em?: string
          cpf_cnpj_obrigatorio?: boolean
          desconto_maximo_percent?: number
          empresa_id?: string
          foto_odometro_obrigatoria?: boolean
          frete_maximo?: number | null
          gps_obrigatorio?: boolean
          materiais_permitidos?: string[] | null
          observacao_obrigatoria?: boolean
          pode_alterar_frete?: boolean
          pode_alterar_valor_produto?: boolean
          pode_cadastrar_cliente?: boolean
          pode_cancelar_entrega?: boolean
          telefone_obrigatorio?: boolean
          valor_venda_maximo?: number | null
          valor_venda_minimo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "permissoes_padrao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pneus: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_instalacao: string
          data_remocao: string | null
          despesa_id: string | null
          empresa_id: string
          foto_url: string | null
          id: string
          km_instalacao: number
          km_remocao: number | null
          lancado_por: string
          marca: string
          modelo: string | null
          motivo_remocao:
            | Database["public"]["Enums"]["pneu_motivo_remocao"]
            | null
          observacoes: string | null
          posicao: string
          status: Database["public"]["Enums"]["pneu_status"]
          tipo: Database["public"]["Enums"]["pneu_tipo"]
          valor: number
          veiculo_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_instalacao?: string
          data_remocao?: string | null
          despesa_id?: string | null
          empresa_id: string
          foto_url?: string | null
          id: string
          km_instalacao?: number
          km_remocao?: number | null
          lancado_por: string
          marca: string
          modelo?: string | null
          motivo_remocao?:
            | Database["public"]["Enums"]["pneu_motivo_remocao"]
            | null
          observacoes?: string | null
          posicao: string
          status?: Database["public"]["Enums"]["pneu_status"]
          tipo?: Database["public"]["Enums"]["pneu_tipo"]
          valor?: number
          veiculo_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_instalacao?: string
          data_remocao?: string | null
          despesa_id?: string | null
          empresa_id?: string
          foto_url?: string | null
          id?: string
          km_instalacao?: number
          km_remocao?: number | null
          lancado_por?: string
          marca?: string
          modelo?: string | null
          motivo_remocao?:
            | Database["public"]["Enums"]["pneu_motivo_remocao"]
            | null
          observacoes?: string | null
          posicao?: string
          status?: Database["public"]["Enums"]["pneu_status"]
          tipo?: Database["public"]["Enums"]["pneu_tipo"]
          valor?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pneus_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pneus_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pneus_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          criado_em: string
          email: string | null
          empresa_id: string
          id: string
          nome: string
          precisa_trocar_senha: boolean
          telefone: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          empresa_id: string
          id: string
          nome: string
          precisa_trocar_senha?: boolean
          telefone?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          precisa_trocar_senha?: boolean
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          criado_em: string
          empresa_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          empresa_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          empresa_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          empresa_id: string
          id: string
          placa: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          placa: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          placa?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      contar_usuarios_empresa: {
        Args: { _empresa_id: string }
        Returns: number
      }
      current_empresa_id: { Args: never; Returns: string }
      empresa_ativa: { Args: { _empresa_id: string }; Returns: boolean }
      fn_iniciar_entrega: {
        Args: { _entrega_id: string; _km_inicial: number; _veiculo_id: string }
        Returns: {
          assinatura_coletada: boolean
          assinatura_url: string | null
          atualizada_em: string
          cliente_id: string
          comissao_motorista: number | null
          comprovante_assinatura_url: string | null
          comprovante_foto_url: string | null
          criada_em: string
          empresa_id: string
          endereco: string | null
          finalizada_em: string | null
          forma_pagamento: string | null
          foto_material_gps_em: string | null
          foto_material_gps_lat: number | null
          foto_material_gps_lng: number | null
          foto_material_url: string | null
          foto_odometro_final_url: string | null
          gps_fim_em: string | null
          gps_fim_lat: number | null
          gps_fim_lng: number | null
          gps_inicio_em: string | null
          gps_inicio_lat: number | null
          gps_inicio_lng: number | null
          id: string
          iniciada_em: string | null
          jornada_id: string | null
          km_final: number | null
          km_inicial: number | null
          lat: number | null
          lng: number | null
          material_id: string
          motorista_entrega_id: string | null
          motorista_id: string
          motorista_venda_id: string | null
          numero: number | null
          observacoes: string | null
          pagamento_confirmado_em: string | null
          pagamento_confirmado_por: string | null
          preco_base_no_momento: number
          quantidade: number
          sincronizada_em: string
          status: Database["public"]["Enums"]["entrega_status"]
          status_pagamento: string
          valor_frete: number
          valor_praticado: number
          veiculo_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "entregas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_permissoes_efetivas: {
        Args: { _motorista_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_da_empresa: { Args: { _empresa_id: string }; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      is_perfil_ativo: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "motorista" | "master"
      despesa_categoria:
        | "manutencao"
        | "pneu"
        | "peca"
        | "pedagio"
        | "alimentacao"
        | "documentacao"
        | "outros"
      despesa_status: "a_conferir" | "conferida"
      entrega_status: "pendente" | "em_rota" | "entregue" | "cancelada"
      pneu_motivo_remocao:
        | "desgaste"
        | "furo"
        | "estouro"
        | "rodizio"
        | "outros"
      pneu_status: "instalado" | "removido"
      pneu_tipo: "novo" | "recapado"
      unidade_medida: "m3" | "tonelada" | "viagem" | "metro" | "unidade"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "motorista", "master"],
      despesa_categoria: [
        "manutencao",
        "pneu",
        "peca",
        "pedagio",
        "alimentacao",
        "documentacao",
        "outros",
      ],
      despesa_status: ["a_conferir", "conferida"],
      entrega_status: ["pendente", "em_rota", "entregue", "cancelada"],
      pneu_motivo_remocao: ["desgaste", "furo", "estouro", "rodizio", "outros"],
      pneu_status: ["instalado", "removido"],
      pneu_tipo: ["novo", "recapado"],
      unidade_medida: ["m3", "tonelada", "viagem", "metro", "unidade"],
    },
  },
} as const
