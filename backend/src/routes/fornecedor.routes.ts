import { Router, Request, Response } from 'express';
import Fornecedor from '../models/Fornecedor';
import ItemFornecedor from '../models/ItemFornecedor';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/fornecedores - Listar todos os fornecedores
router.get('/', async (req: Request, res: Response) => {
  try {
    const { ativo } = req.query;
    
    const filter: any = {};
    if (ativo !== undefined) {
      filter.ativo = ativo === 'true';
    }

    const fornecedores = await Fornecedor.find(filter)
      .sort({ razaoSocial: 1 })
      .select('-__v');

    res.json(fornecedores);
  } catch (error) {
    console.error('Erro ao listar fornecedores:', error);
    res.status(500).json({ error: 'Erro ao listar fornecedores' });
  }
});

// GET /api/fornecedores/:id - Buscar fornecedor por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const fornecedor = await Fornecedor.findById(req.params.id).select('-__v');

    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    res.json(fornecedor);
  } catch (error) {
    console.error('Erro ao buscar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao buscar fornecedor' });
  }
});

// POST /api/fornecedores - Criar novo fornecedor
router.post('/', async (req: Request, res: Response) => {
  try {
    const { cnpj } = req.body;

    // Verifica se CNPJ já existe
    const fornecedorExistente = await Fornecedor.findOne({ cnpj });
    if (fornecedorExistente) {
      return res.status(400).json({ error: 'CNPJ já cadastrado' });
    }

    const fornecedor = new Fornecedor(req.body);
    await fornecedor.save();

    res.status(201).json(fornecedor);
  } catch (error: any) {
    console.error('Erro ao criar fornecedor:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'CNPJ já cadastrado' });
    }
    
    res.status(500).json({ error: 'Erro ao criar fornecedor' });
  }
});

// PUT /api/fornecedores/:id - Atualizar fornecedor
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { cnpj } = req.body;

    // Se estiver alterando o CNPJ, verifica se já existe
    if (cnpj) {
      const fornecedorExistente = await Fornecedor.findOne({
        cnpj,
        _id: { $ne: req.params.id },
      });
      
      if (fornecedorExistente) {
        return res.status(400).json({ error: 'CNPJ já cadastrado para outro fornecedor' });
      }
    }

    const fornecedor = await Fornecedor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    res.json(fornecedor);
  } catch (error) {
    console.error('Erro ao atualizar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao atualizar fornecedor' });
  }
});

// DELETE /api/fornecedores/:id - Inativar fornecedor (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const fornecedor = await Fornecedor.findByIdAndUpdate(
      req.params.id,
      { ativo: false },
      { new: true }
    ).select('-__v');

    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    res.json({ message: 'Fornecedor inativado com sucesso', fornecedor });
  } catch (error) {
    console.error('Erro ao inativar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao inativar fornecedor' });
  }
});

// POST /api/fornecedores/:id/ativar - Reativar fornecedor
router.post('/:id/ativar', async (req: Request, res: Response) => {
  try {
    const fornecedor = await Fornecedor.findByIdAndUpdate(
      req.params.id,
      { ativo: true },
      { new: true }
    ).select('-__v');

    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    res.json({ message: 'Fornecedor ativado com sucesso', fornecedor });
  } catch (error) {
    console.error('Erro ao ativar fornecedor:', error);
    res.status(500).json({ error: 'Erro ao ativar fornecedor' });
  }
});

// GET /api/fornecedores/:id/itens - Listar itens vinculados ao fornecedor
router.get('/:id/itens', async (req: Request, res: Response) => {
  try {
    const itens = await ItemFornecedor.find({
      fornecedorId: req.params.id,
      ativo: true,
    })
      .populate('fornecedorId', 'razaoSocial nomeFantasia')
      .sort({ codigoItem: 1 });

    res.json(itens);
  } catch (error) {
    console.error('Erro ao listar itens do fornecedor:', error);
    res.status(500).json({ error: 'Erro ao listar itens do fornecedor' });
  }
});

// POST /api/fornecedores/:id/itens - Vincular item ao fornecedor
router.post('/:id/itens', async (req: Request, res: Response) => {
  try {
    const { codigoItem, valorUnitario, prazoEntrega, observacoes, principal } = req.body;

    // Verifica se fornecedor existe
    const fornecedor = await Fornecedor.findById(req.params.id);
    if (!fornecedor) {
      return res.status(404).json({ error: 'Fornecedor não encontrado' });
    }

    // Se for principal, remove principal dos outros fornecedores deste item
    if (principal) {
      await ItemFornecedor.updateMany(
        { codigoItem, principal: true },
        { principal: false }
      );
    }

    // Verifica se vínculo já existe
    const vinculoExistente = await ItemFornecedor.findOne({
      codigoItem,
      fornecedorId: req.params.id,
    });

    if (vinculoExistente) {
      // Atualiza vínculo existente
      vinculoExistente.valorUnitario = valorUnitario;
      vinculoExistente.prazoEntrega = prazoEntrega;
      vinculoExistente.observacoes = observacoes;
      vinculoExistente.principal = principal || false;
      vinculoExistente.ativo = true;
      await vinculoExistente.save();
      
      return res.json(vinculoExistente);
    }

    // Cria novo vínculo
    const itemFornecedor = new ItemFornecedor({
      codigoItem,
      fornecedorId: req.params.id,
      valorUnitario,
      prazoEntrega,
      observacoes,
      principal: principal || false,
    });

    await itemFornecedor.save();
    res.status(201).json(itemFornecedor);
  } catch (error) {
    console.error('Erro ao vincular item ao fornecedor:', error);
    res.status(500).json({ error: 'Erro ao vincular item ao fornecedor' });
  }
});

// GET /api/fornecedores/item/:codigoItem - Buscar fornecedores de um item
router.get('/item/:codigoItem', async (req: Request, res: Response) => {
  try {
    const fornecedores = await ItemFornecedor.find({
      codigoItem: req.params.codigoItem,
      ativo: true,
    })
      .populate('fornecedorId')
      .sort({ principal: -1, valorUnitario: 1 });

    res.json(fornecedores);
  } catch (error) {
    console.error('Erro ao buscar fornecedores do item:', error);
    res.status(500).json({ error: 'Erro ao buscar fornecedores do item' });
  }
});

export default router;
