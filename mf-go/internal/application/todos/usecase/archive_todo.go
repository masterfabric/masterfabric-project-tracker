package usecase

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/masterfabric/masterfabric_go_basic/internal/application/todos/dto"
	iamRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/iam/repository"
	todoRepo "github.com/masterfabric/masterfabric_go_basic/internal/domain/todos/repository"
)

type ArchiveTodoUseCase struct {
	repo     todoRepo.TodoRepository
	userRepo iamRepo.UserRepository
}

func NewArchiveTodoUseCase(repo todoRepo.TodoRepository, userRepo iamRepo.UserRepository) *ArchiveTodoUseCase {
	return &ArchiveTodoUseCase{repo: repo, userRepo: userRepo}
}

func (uc *ArchiveTodoUseCase) Execute(ctx context.Context, userID, todoID uuid.UUID) error {
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return err
	}
	if err := uc.repo.ArchiveByID(ctx, todoID, userID); err != nil {
		return fmt.Errorf("archiveTodo: %w", err)
	}
	return nil
}

type UnarchiveTodoUseCase struct {
	repo     todoRepo.TodoRepository
	userRepo iamRepo.UserRepository
}

func NewUnarchiveTodoUseCase(repo todoRepo.TodoRepository, userRepo iamRepo.UserRepository) *UnarchiveTodoUseCase {
	return &UnarchiveTodoUseCase{repo: repo, userRepo: userRepo}
}

func (uc *UnarchiveTodoUseCase) Execute(ctx context.Context, userID, todoID uuid.UUID) error {
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return err
	}
	if err := uc.repo.UnarchiveByID(ctx, todoID, userID); err != nil {
		return fmt.Errorf("unarchiveTodo: %w", err)
	}
	return nil
}

type ListArchivedTodosUseCase struct {
	repo     todoRepo.TodoRepository
	userRepo iamRepo.UserRepository
}

func NewListArchivedTodosUseCase(repo todoRepo.TodoRepository, userRepo iamRepo.UserRepository) *ListArchivedTodosUseCase {
	return &ListArchivedTodosUseCase{repo: repo, userRepo: userRepo}
}

func (uc *ListArchivedTodosUseCase) Execute(ctx context.Context, userID uuid.UUID) ([]*dto.TodoResponse, error) {
	if err := ensureActiveUserForTodos(ctx, uc.userRepo, userID); err != nil {
		return nil, err
	}
	todos, err := uc.repo.ListArchivedByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("listArchivedTodos: %w", err)
	}
	result := make([]*dto.TodoResponse, 0, len(todos))
	for _, t := range todos {
		result = append(result, todoToResponse(t))
	}
	return result, nil
}
