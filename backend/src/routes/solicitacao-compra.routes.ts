import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PerfilEnum } from '../types/enums';
import SolicitacaoCompra, { StatusSolicitacao } from '../models/SolicitacaoCompra';
import { User } from '../models/User';

const router = Router();

// GET / - Listar solicitações
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const perfil = req.user!.perfil;
    let filter = {};

    // RECEBIMENTO só vê as próprias; COMPRADOR/DIRETORIA/ADMIN vêem todas
    if (perfil === PerfilEnum.RECEBIMENTO) {
      filter = { solicitante_id: req.user!.id };
    } else if (![PerfilEnum.COMPRADOR, PerfilEnum.DIRETORIA, PerfilEnum.ADMIN].includes(perfil)) {
      return res.status(403).json({ message: 'Permissão negada' });
    }

    const solicitacoes = await SolicitacaoCompra.find(filter).sort({ createdAt: -1 });
    res.json(solicitacoes);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar solicitações' });
  }
});

// POST / - Criar solicitação (RECEBIMENTO + ADMIN)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const perfil = req.user!.perfil;
    if (![PerfilEnum.RECEBIMENTO, PerfilEnum.ADMIN].includes(perfil)) {
      return res.status(403).json({ message: 'Permissão negada' });
    }

    const { assunto, descricao, itens } = req.body;

    if (!assunto || !itens || itens.length === 0) {
      return res.status(400).json({ message: 'Assunto e pelo menos 1 item são obrigatórios' });
    }

    const userDoc = await User.findById(req.user!.id).select('nome');
    const nomeUsuario = userDoc?.nome || req.user!.email;

    const solicitacao = new SolicitacaoCompra({
      assunto,
      descricao,
      itens,
      status_atual: StatusSolicitacao.NOVA,
      solicitante_id: req.user!.id,
      solicitante_nome: nomeUsuario,
      historico_status: [{
        status: StatusSolicitacao.NOVA,
        usuario_id: req.user!.id,
        usuario_nome: nomeUsuario,
        data: new Date()
      }]
    });

    await solicitacao.save();
    res.status(201).json(solicitacao);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar solicitação' });
  }
});

// PUT /:id/status - Atualizar status (COMPRADOR, DIRETORIA, ADMIN)
router.put('/:id/status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const perfil = req.user!.perfil;
    if (![PerfilEnum.COMPRADOR, PerfilEnum.DIRETORIA, PerfilEnum.ADMIN].includes(perfil)) {
      return res.status(403).json({ message: 'Permissão negada' });
    }

    const { status, observacao } = req.body;

    if (!status || !Object.values(StatusSolicitacao).includes(status)) {
      return res.status(400).json({ message: 'Status inválido' });
    }

    const solicitacao = await SolicitacaoCompra.findById(req.params.id);
    if (!solicitacao) {
      return res.status(404).json({ message: 'Solicitação não encontrada' });
    }

    const userDoc = await User.findById(req.user!.id).select('nome');
    const nomeUsuario = userDoc?.nome || req.user!.email;

    solicitacao.status_atual = status;
    solicitacao.historico_status.push({
      status,
      usuario_id: req.user!.id as any,
      usuario_nome: nomeUsuario,
      data: new Date(),
      observacao
    });

    await solicitacao.save();
    res.json(solicitacao);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

// DELETE /:id - Deletar solicitação (própria se NOVA, ou ADMIN)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const solicitacao = await SolicitacaoCompra.findById(req.params.id);
    if (!solicitacao) {
      return res.status(404).json({ message: 'Solicitação não encontrada' });
    }

    const perfil = req.user!.perfil;
    const isOwner = solicitacao.solicitante_id.toString() === req.user!.id;
    const isAdmin = perfil === PerfilEnum.ADMIN;

    if (isAdmin || (isOwner && solicitacao.status_atual === StatusSolicitacao.NOVA)) {
      await SolicitacaoCompra.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Solicitação excluída' });
    }

    return res.status(403).json({ message: 'Permissão negada' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao excluir solicitação' });
  }
});

export default router;
